package service

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
	"github.com/vllm-sandbox/dashboard-backend/internal/config"
	"github.com/vllm-sandbox/dashboard-backend/internal/domain"
)

type DockerService interface {
	GetStatus(ctx context.Context) (*domain.VLLMStatus, error)
	Start(ctx context.Context, cfg domain.VLLMConfig) error
	Stop(ctx context.Context) error
	Restart(ctx context.Context) error
	StreamLogs(ctx context.Context, lineChan chan<- string, errChan chan<- error)
}

type dockerService struct {
	cli *client.Client
	cfg *config.Config
}

func NewDockerService(cfg *config.Config) (DockerService, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %w", err)
	}
	return &dockerService{cli: cli, cfg: cfg}, nil
}

func (s *dockerService) GetStatus(ctx context.Context) (*domain.VLLMStatus, error) {
	inspect, err := s.cli.ContainerInspect(ctx, s.cfg.VLLMContainerName)
	if err != nil {
		if client.IsErrNotFound(err) {
			return &domain.VLLMStatus{
				Status: "stopped",
				Label:  "Stopped",
				Color:  "gray",
			}, nil
		}
		return &domain.VLLMStatus{
			Status: "unreachable",
			Label:  "Docker Unreachable",
			Color:  "red",
		}, nil
	}

	state := inspect.State.Status
	status := &domain.VLLMStatus{
		Status: state,
		Label:  strings.Title(state),
		Color:  "gray",
	}

	if state == "running" {
		status.Label = "Starting Up..."
		status.Color = "yellow"

		// Check /health endpoint
		clientHTTP := &http.Client{Timeout: 2 * time.Second}
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/health", s.cfg.VLLMAPIBase), nil)
		if resp, err := clientHTTP.Do(req); err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				status.Status = "ready"
				status.Label = "Ready ✓"
				status.Color = "green"

				// Get current served model name
				if modelName := s.fetchActiveModel(ctx); modelName != "" {
					status.Model = &modelName
				}
			} else {
				status.Label = "Loading Weights..."
				status.Color = "yellow"
			}
		}
	} else if state == "exited" || state == "dead" {
		if inspect.State.ExitCode != 0 {
			status.Status = "error"
			status.Label = fmt.Sprintf("Error (exit %d)", inspect.State.ExitCode)
			status.Color = "red"
		}
	}

	// Fetch VRAM from DCGM exporter
	s.fetchVRAMMetrics(ctx, status)

	return status, nil
}

func (s *dockerService) fetchActiveModel(ctx context.Context) string {
	clientHTTP := &http.Client{Timeout: 2 * time.Second}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/v1/models", s.cfg.VLLMAPIBase), nil)
	if s.cfg.VLLMAPIKey != "" {
		req.Header.Set("Authorization", "Bearer "+s.cfg.VLLMAPIKey)
	}
	resp, err := clientHTTP.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	buf := new(strings.Builder)
	_, _ = io.Copy(buf, resp.Body)
	if strings.Contains(buf.String(), `"id":"`) {
		parts := strings.Split(buf.String(), `"id":"`)
		if len(parts) > 1 {
			return strings.Split(parts[1], `"`)[0]
		}
	}
	return ""
}

func (s *dockerService) fetchVRAMMetrics(ctx context.Context, status *domain.VLLMStatus) {
	clientHTTP := &http.Client{Timeout: 2 * time.Second}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, s.cfg.DCGMExporterURL, nil)
	resp, err := clientHTTP.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	var vramUsed, vramFree float64
	hasUsed, hasFree := false, false

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "DCGM_FI_DEV_FB_USED") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				if v, err := strconv.ParseFloat(fields[len(fields)-1], 64); err == nil {
					vramUsed = v
					hasUsed = true
				}
			}
		} else if strings.HasPrefix(line, "DCGM_FI_DEV_FB_FREE") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				if v, err := strconv.ParseFloat(fields[len(fields)-1], 64); err == nil {
					vramFree = v
					hasFree = true
				}
			}
		}
	}

	if hasUsed && hasFree {
		total := int(vramUsed + vramFree)
		used := int(vramUsed)
		status.VRAMUsedMB = &used
		status.VRAMTotalMB = &total
	}
}

func (s *dockerService) Start(ctx context.Context, cfg domain.VLLMConfig) error {
	// Stop and remove existing container if present
	_ = s.Stop(ctx)

	// Build command flags
	cmd := []string{
		cfg.ModelID,
		"--gpu-memory-utilization", fmt.Sprintf("%.2f", cfg.GPUMemoryUtilization),
		"--max-model-len", strconv.Itoa(cfg.MaxModelLen),
		"--dtype", cfg.DType,
	}
	if cfg.ServedModelName != nil && *cfg.ServedModelName != "" {
		cmd = append(cmd, "--served-model-name", *cfg.ServedModelName)
	}
	if cfg.Quantization != nil && *cfg.Quantization != "" {
		cmd = append(cmd, "--quantization", *cfg.Quantization)
	}
	if cfg.TensorParallelSize > 1 {
		cmd = append(cmd, "--tensor-parallel-size", strconv.Itoa(cfg.TensorParallelSize))
	}
	if cfg.TrustRemoteCode {
		cmd = append(cmd, "--trust-remote-code")
	}
	if cfg.EnablePrefixCaching {
		cmd = append(cmd, "--enable-prefix-caching")
	}
	if s.cfg.VLLMAPIKey != "" {
		cmd = append(cmd, "--api-key", s.cfg.VLLMAPIKey)
	}
	if cfg.ExtraArgs != nil && *cfg.ExtraArgs != "" {
		cmd = append(cmd, strings.Fields(*cfg.ExtraArgs)...)
	}

	env := []string{
		"HF_HOME=/root/.cache/huggingface",
		"HUGGING_FACE_HUB_TOKEN=" + s.cfg.HFToken,
		"VLLM_API_KEY=" + s.cfg.VLLMAPIKey,
	}

	homeDir, _ := os.UserHomeDir()
	hfCache := filepath.Join(homeDir, ".cache", "huggingface")

	resp, err := s.cli.ContainerCreate(
		ctx,
		&container.Config{
			Image: s.cfg.VLLMImage,
			Cmd:   cmd,
			Env:   env,
			ExposedPorts: nat.PortSet{
				"8000/tcp": struct{}{},
			},
		},
		&container.HostConfig{
			IpcMode: "host",
			PortBindings: nat.PortMap{
				"8000/tcp": []nat.PortBinding{{HostPort: "8000"}},
			},
			Mounts: []mount.Mount{
				{
					Type:   mount.TypeBind,
					Source: hfCache,
					Target: "/root/.cache/huggingface",
				},
			},
			Resources: container.Resources{
				DeviceRequests: []container.DeviceRequest{
					{Count: -1, Capabilities: [][]string{{"gpu"}}},
				},
			},
			RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
		},
		&network.NetworkingConfig{
			EndpointsConfig: map[string]*network.EndpointSettings{
				s.cfg.DockerNetwork: {},
			},
		},
		nil,
		s.cfg.VLLMContainerName,
	)
	if err != nil {
		return fmt.Errorf("failed to create vLLM container: %w", err)
	}

	if err := s.cli.ContainerStart(ctx, resp.ID, types.ContainerStartOptions{}); err != nil {
		return fmt.Errorf("failed to start vLLM container: %w", err)
	}

	return nil
}

func (s *dockerService) Stop(ctx context.Context) error {
	inspect, err := s.cli.ContainerInspect(ctx, s.cfg.VLLMContainerName)
	if err != nil {
		return nil // Not found
	}

	timeoutSec := 15
	_ = s.cli.ContainerStop(ctx, inspect.ID, container.StopOptions{Timeout: &timeoutSec})
	_ = s.cli.ContainerRemove(ctx, inspect.ID, types.ContainerRemoveOptions{Force: true})

	// Wait 2 seconds for GPU VRAM to be fully freed
	time.Sleep(2 * time.Second)
	return nil
}

func (s *dockerService) Restart(ctx context.Context) error {
	timeoutSec := 15
	return s.cli.ContainerRestart(ctx, s.cfg.VLLMContainerName, container.StopOptions{Timeout: &timeoutSec})
}

func (s *dockerService) StreamLogs(ctx context.Context, lineChan chan<- string, errChan chan<- error) {
	defer close(lineChan)

	reader, err := s.cli.ContainerLogs(ctx, s.cfg.VLLMContainerName, types.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       "100",
		Timestamps: false,
	})
	if err != nil {
		errChan <- err
		return
	}
	defer reader.Close()

	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
			line := scanner.Text()
			if len(line) > 8 && (line[0] == 1 || line[0] == 2) {
				line = line[8:]
			}
			line = strings.TrimSpace(line)
			if line != "" {
				lineChan <- line
			}
		}
	}
	if err := scanner.Err(); err != nil {
		errChan <- err
	}
}

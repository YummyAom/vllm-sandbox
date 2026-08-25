package repository

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/vllm-sandbox/dashboard-backend/internal/domain"
)

type PresetRepository interface {
	GetAll() ([]domain.Preset, error)
	Save(preset domain.Preset) error
	Delete(name string) error
}

type filePresetRepository struct {
	filePath string
	mu       sync.RWMutex
}

func NewFilePresetRepository(filePath string) PresetRepository {
	repo := &filePresetRepository{filePath: filePath}
	repo.initDefaultsIfEmpty()
	return repo
}

func (r *filePresetRepository) initDefaultsIfEmpty() {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, err := os.Stat(r.filePath); err == nil {
		return
	}

	_ = os.MkdirAll(filepath.Dir(r.filePath), 0755)

	defaults := []domain.Preset{
		{
			Name: "Qwen2.5 0.5B (Tiny - Fast)",
			Config: domain.VLLMConfig{
				ModelID:              "Qwen/Qwen2.5-0.5B-Instruct",
				GPUMemoryUtilization: 0.5,
				MaxModelLen:          4096,
				DType:                "auto",
				TensorParallelSize:   1,
				TrustRemoteCode:      true,
			},
		},
		{
			Name: "Qwen2.5 7B (Balanced)",
			Config: domain.VLLMConfig{
				ModelID:              "Qwen/Qwen2.5-7B-Instruct",
				GPUMemoryUtilization: 0.85,
				MaxModelLen:          8192,
				DType:                "auto",
				TensorParallelSize:   1,
				TrustRemoteCode:      true,
				EnablePrefixCaching:  true,
			},
		},
		{
			Name: "Llama-3.2 3B (Meta)",
			Config: domain.VLLMConfig{
				ModelID:              "meta-llama/Llama-3.2-3B-Instruct",
				GPUMemoryUtilization: 0.7,
				MaxModelLen:          8192,
				DType:                "auto",
				TensorParallelSize:   1,
				EnablePrefixCaching:  true,
			},
		},
		{
			Name: "DeepSeek-R1 7B (Reasoning)",
			Config: domain.VLLMConfig{
				ModelID:              "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
				GPUMemoryUtilization: 0.90,
				MaxModelLen:          8192,
				DType:                "auto",
				TensorParallelSize:   1,
				TrustRemoteCode:      true,
			},
		},
	}

	data, err := json.MarshalIndent(defaults, "", "  ")
	if err == nil {
		_ = os.WriteFile(r.filePath, data, 0644)
	}
}

func (r *filePresetRepository) GetAll() ([]domain.Preset, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	data, err := os.ReadFile(r.filePath)
	if err != nil {
		return []domain.Preset{}, nil
	}

	var presets []domain.Preset
	if err := json.Unmarshal(data, &presets); err != nil {
		return []domain.Preset{}, nil
	}
	return presets, nil
}

func (r *filePresetRepository) Save(preset domain.Preset) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	presets := []domain.Preset{}
	if data, err := os.ReadFile(r.filePath); err == nil {
		_ = json.Unmarshal(data, &presets)
	}

	updated := false
	for i, p := range presets {
		if p.Name == preset.Name {
			presets[i] = preset
			updated = true
			break
		}
	}
	if !updated {
		presets = append(presets, preset)
	}

	data, err := json.MarshalIndent(presets, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(r.filePath, data, 0644)
}

func (r *filePresetRepository) Delete(name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	var presets []domain.Preset
	data, err := os.ReadFile(r.filePath)
	if err != nil {
		return nil
	}
	_ = json.Unmarshal(data, &presets)

	filtered := []domain.Preset{}
	for _, p := range presets {
		if p.Name != name {
			filtered = append(filtered, p)
		}
	}

	out, err := json.MarshalIndent(filtered, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(r.filePath, out, 0644)
}

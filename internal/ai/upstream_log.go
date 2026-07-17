package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"time"
)

const (
	defaultAIUpstreamLogDir            = ".codex/logs"
	defaultAIUpstreamLogFilename       = "ai-upstream.log"
	defaultAIUpstreamLogMaxStringRunes = 1200
	defaultAIUpstreamLogMaxArrayItems  = 20
)

type UpstreamLogConfig struct {
	Enabled        bool
	Dir            string
	Filename       string
	MaxStringRunes int
	MaxArrayItems  int
}

type UpstreamLogEntry struct {
	Operation  string
	ModelType  string
	Provider   string
	ModelName  string
	BaseURL    string
	Endpoint   string
	StatusCode int
	Duration   time.Duration
	Request    any
	Response   any
	Error      error
}

type upstreamLogWriter struct {
	mu             sync.Mutex
	enabled        bool
	filePath       string
	maxStringRunes int
	maxArrayItems  int
}

var aiUpstreamLogWriter = &upstreamLogWriter{}

func InitUpstreamLogger(cfg UpstreamLogConfig) {
	dir := strings.TrimSpace(cfg.Dir)
	if dir == "" {
		dir = defaultAIUpstreamLogDir
	}
	filename := strings.TrimSpace(cfg.Filename)
	if filename == "" {
		filename = defaultAIUpstreamLogFilename
	}
	maxStringRunes := cfg.MaxStringRunes
	if maxStringRunes <= 0 {
		maxStringRunes = defaultAIUpstreamLogMaxStringRunes
	}
	maxArrayItems := cfg.MaxArrayItems
	if maxArrayItems <= 0 {
		maxArrayItems = defaultAIUpstreamLogMaxArrayItems
	}

	aiUpstreamLogWriter.mu.Lock()
	defer aiUpstreamLogWriter.mu.Unlock()
	aiUpstreamLogWriter.enabled = cfg.Enabled
	aiUpstreamLogWriter.filePath = filepath.Join(dir, filename)
	aiUpstreamLogWriter.maxStringRunes = maxStringRunes
	aiUpstreamLogWriter.maxArrayItems = maxArrayItems
}

func LogUpstreamCall(ctx context.Context, entry UpstreamLogEntry) {
	_ = ctx
	aiUpstreamLogWriter.write(entry)
}

func (w *upstreamLogWriter) write(entry UpstreamLogEntry) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if !w.enabled {
		return
	}
	filePath := w.filePath
	if filePath == "" {
		filePath = filepath.Join(defaultAIUpstreamLogDir, defaultAIUpstreamLogFilename)
	}
	maxStringRunes := w.maxStringRunes
	if maxStringRunes <= 0 {
		maxStringRunes = defaultAIUpstreamLogMaxStringRunes
	}
	maxArrayItems := w.maxArrayItems
	if maxArrayItems <= 0 {
		maxArrayItems = defaultAIUpstreamLogMaxArrayItems
	}
	record := map[string]any{
		"time":       time.Now().Format(time.RFC3339Nano),
		"operation":  entry.Operation,
		"modelType":  entry.ModelType,
		"provider":   entry.Provider,
		"model":      entry.ModelName,
		"baseUrl":    entry.BaseURL,
		"endpoint":   entry.Endpoint,
		"statusCode": entry.StatusCode,
		"durationMs": entry.Duration.Milliseconds(),
		"request":    sanitizeAIUpstreamLogValue(entry.Request, maxStringRunes, maxArrayItems),
		"response":   sanitizeAIUpstreamLogValue(entry.Response, maxStringRunes, maxArrayItems),
	}
	if entry.Error != nil {
		record["error"] = truncateRunes(entry.Error.Error(), maxStringRunes)
	}

	if err := os.MkdirAll(filepath.Dir(filePath), 0750); err != nil {
		slog.Warn("create ai upstream log directory failed", "path", filepath.Dir(filePath), "error", err)
		return
	}
	file, err := os.OpenFile(filePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		slog.Warn("open ai upstream log file failed", "path", filePath, "error", err)
		return
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(record); err != nil {
		slog.Warn("write ai upstream log failed", "path", filePath, "error", err)
	}
}

func sanitizeAIUpstreamLogValue(value any, maxStringRunes int, maxArrayItems int) any {
	if value == nil {
		return nil
	}
	if maxStringRunes <= 0 {
		maxStringRunes = defaultAIUpstreamLogMaxStringRunes
	}
	if maxArrayItems <= 0 {
		maxArrayItems = defaultAIUpstreamLogMaxArrayItems
	}
	switch v := value.(type) {
	case error:
		return truncateRunes(v.Error(), maxStringRunes)
	case string:
		return truncateRunes(v, maxStringRunes)
	case []byte:
		return sanitizeBytesForAIUpstreamLog(v, maxStringRunes, maxArrayItems)
	case json.RawMessage:
		return sanitizeBytesForAIUpstreamLog([]byte(v), maxStringRunes, maxArrayItems)
	}
	return sanitizeReflectValue(reflect.ValueOf(value), maxStringRunes, maxArrayItems)
}

func sanitizeBytesForAIUpstreamLog(value []byte, maxStringRunes int, maxArrayItems int) any {
	var decoded any
	if err := json.Unmarshal(value, &decoded); err == nil {
		return sanitizeAIUpstreamLogValue(decoded, maxStringRunes, maxArrayItems)
	}
	return truncateRunes(string(value), maxStringRunes)
}

func sanitizeReflectValue(value reflect.Value, maxStringRunes int, maxArrayItems int) any {
	if !value.IsValid() {
		return nil
	}
	for value.Kind() == reflect.Pointer || value.Kind() == reflect.Interface {
		if value.IsNil() {
			return nil
		}
		value = value.Elem()
	}
	switch value.Kind() {
	case reflect.String:
		return truncateRunes(value.String(), maxStringRunes)
	case reflect.Bool:
		return value.Bool()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return value.Int()
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return value.Uint()
	case reflect.Float32, reflect.Float64:
		return value.Float()
	case reflect.Map:
		result := make(map[string]any, value.Len())
		iter := value.MapRange()
		for iter.Next() {
			key := fmt.Sprint(sanitizeReflectValue(iter.Key(), maxStringRunes, maxArrayItems))
			if isSensitiveAIUpstreamLogKey(key) {
				result[key] = "[REDACTED]"
				continue
			}
			result[key] = sanitizeAIUpstreamLogValue(iter.Value().Interface(), maxStringRunes, maxArrayItems)
		}
		return result
	case reflect.Slice, reflect.Array:
		length := value.Len()
		limit := length
		truncated := false
		if limit > maxArrayItems {
			limit = maxArrayItems
			truncated = true
		}
		items := make([]any, 0, limit)
		for i := 0; i < limit; i++ {
			items = append(items, sanitizeAIUpstreamLogValue(value.Index(i).Interface(), maxStringRunes, maxArrayItems))
		}
		if !truncated {
			return items
		}
		return map[string]any{
			"items":     items,
			"count":     length,
			"truncated": true,
		}
	case reflect.Struct:
		raw, err := json.Marshal(value.Interface())
		if err == nil {
			return sanitizeBytesForAIUpstreamLog(raw, maxStringRunes, maxArrayItems)
		}
	}
	return truncateRunes(fmt.Sprint(value.Interface()), maxStringRunes)
}

func isSensitiveAIUpstreamLogKey(key string) bool {
	normalized := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(key, "_", ""), "-", ""), " ", ""))
	if normalized == "ak" || normalized == "sk" {
		return true
	}
	for _, token := range []string{
		"authorization",
		"apikey",
		"accesskey",
		"secretkey",
		"secret",
		"token",
		"password",
		"credential",
		"bearer",
	} {
		if strings.Contains(normalized, token) {
			return true
		}
	}
	return false
}

func truncateRunes(value string, limit int) string {
	value = strings.TrimSpace(value)
	if limit <= 0 {
		return value
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit]) + fmt.Sprintf("... [truncated, runes=%d]", len(runes))
}

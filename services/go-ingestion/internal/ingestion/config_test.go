package ingestion

import (
	"os"
	"testing"
)

func TestLoadConfig(t *testing.T) {
	t.Setenv("KINESIS_STREAM", "test-stream")
	t.Setenv("AWS_REGION", "us-west-2")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if cfg.StreamName != "test-stream" {
		t.Errorf("expected stream name test-stream, got %s", cfg.StreamName)
	}

	if cfg.AWSRegion != "us-west-2" {
		t.Errorf("expected region us-west-2, got %s", cfg.AWSRegion)
	}
}

func TestLoadConfigRequiresStream(t *testing.T) {
	os.Unsetenv("KINESIS_STREAM")

	if _, err := LoadConfig(); err == nil {
		t.Fatalf("expected error when KINESIS_STREAM is missing")
	}
}

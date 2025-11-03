package ingestion

import (
	"fmt"
	"os"
)

type Config struct {
	StreamName string
	AWSRegion  string
}

func LoadConfig() (*Config, error) {
	stream := os.Getenv("KINESIS_STREAM")
	if stream == "" {
		return nil, fmt.Errorf("KINESIS_STREAM is required")
	}

	region := os.Getenv("AWS_REGION")
	if region == "" {
		region = "us-east-1"
	}

	return &Config{
		StreamName: stream,
		AWSRegion:  region,
	}, nil
}

package ingestion

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	kinesis "github.com/aws/aws-sdk-go-v2/service/kinesis"
)

type KinesisProducer struct {
	client *kinesis.Client
}

func NewKinesisProducer(ctx context.Context, cfg *Config) (*KinesisProducer, error) {
	awsCfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(cfg.AWSRegion))
	if err != nil {
		return nil, err
	}

	client := kinesis.NewFromConfig(awsCfg)

	return &KinesisProducer{client: client}, nil
}

func (p *KinesisProducer) PutRecords(ctx context.Context, params *kinesis.PutRecordsInput, optFns ...func(*kinesis.Options)) (*kinesis.PutRecordsOutput, error) {
	return p.client.PutRecords(ctx, params, optFns...)
}

func (p *KinesisProducer) Close() error {
	return nil
}

func NewStaticProducer(client *kinesis.Client) *KinesisProducer {
	return &KinesisProducer{client: client}
}

func newAWSConfig(region string) (aws.Config, error) {
	return config.LoadDefaultConfig(context.Background(), config.WithRegion(region))
}

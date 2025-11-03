package ingestion

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/kinesis"
	"github.com/aws/aws-sdk-go-v2/service/kinesis/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/rs/zerolog"
)

type Producer interface {
	PutRecords(ctx context.Context, params *kinesis.PutRecordsInput, optFns ...func(*kinesis.Options)) (*kinesis.PutRecordsOutput, error)
	Close() error
}

type Handler struct {
	producer Producer
	cfg      *Config
	registry prometheus.Registerer
	logger   zerolog.Logger
	ready    bool
}

var RequestDuration = prometheus.NewHistogram(prometheus.HistogramOpts{
	Namespace: "sreorg",
	Subsystem: "ingestion",
	Name:      "request_duration_seconds",
	Help:      "Duration of ingestion HTTP requests",
	Buckets:   prometheus.DefBuckets,
})

type EventPayload struct {
	ProjectID string                 `json:"projectId"`
	EventID   string                 `json:"eventId"`
	Timestamp time.Time              `json:"timestamp"`
	Type      string                 `json:"type"`
	Payload   map[string]interface{} `json:"payload"`
}

func NewHandler(producer Producer, cfg *Config, registry prometheus.Registerer, logger zerolog.Logger) *Handler {
	return &Handler{
		producer: producer,
		cfg:      cfg,
		registry: registry,
		logger:   logger,
		ready:    true,
	}
}

func (h *Handler) PostEvent(w http.ResponseWriter, r *http.Request) {
	timer := prometheus.NewTimer(RequestDuration)
	defer timer.ObserveDuration()

	ctx := r.Context()
	var payload EventPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	if payload.ProjectID == "" || payload.EventID == "" {
		http.Error(w, "missing required fields", http.StatusBadRequest)
		return
	}

	data, err := json.Marshal(payload)
	if err != nil {
		http.Error(w, "failed to serialize payload", http.StatusInternalServerError)
		return
	}

	input := &kinesis.PutRecordsInput{
		StreamName: &h.cfg.StreamName,
		Records: []types.PutRecordsRequestEntry{
			{
				Data:         data,
				PartitionKey: &payload.ProjectID,
			},
		},
	}

	if _, err := h.producer.PutRecords(ctx, input); err != nil {
		h.logger.Error().Err(err).Msg("failed to write to kinesis")
		http.Error(w, "failed to process event", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusAccepted)
}

func HealthHandler(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func (h *Handler) ReadinessHandler(w http.ResponseWriter, _ *http.Request) {
	if !h.ready {
		http.Error(w, "not ready", http.StatusServiceUnavailable)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ready"))
}

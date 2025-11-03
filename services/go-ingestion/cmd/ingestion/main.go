package main

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	promhttp "github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/example/sreorg/go-ingestion/internal/ingestion"
)

func main() {
	zerolog.TimeFieldFormat = time.RFC3339Nano
	logger := log.Output(zerolog.ConsoleWriter{Out: os.Stdout})

	cfg, err := ingestion.LoadConfig()
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to load configuration")
	}

	ctx := context.Background()
	producer, err := ingestion.NewKinesisProducer(ctx, cfg)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to create kinesis producer")
	}
	defer producer.Close()

	registry := prometheus.NewRegistry()
	registry.MustRegister(ingestion.RequestDuration)

	handler := ingestion.NewHandler(producer, cfg, registry, logger)

	r := chi.NewRouter()
	r.Use(ingestion.LoggingMiddleware(logger))
	r.Get("/healthz", ingestion.HealthHandler)
	r.Get("/readyz", handler.ReadinessHandler)
	r.Handle("/metrics", promhttp.HandlerFor(registry, promhttp.HandlerOpts{}))
	r.Post("/v1/events", handler.PostEvent)

	srv := &http.Server{
		Addr:         ":8080",
		Handler:      r,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	logger.Info().Str("address", srv.Addr).Msg("starting ingestion service")
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Fatal().Err(err).Msg("server exited unexpectedly")
	}
}

output "firehose_stream_name" {
  description = "Name of the Firehose stream forwarding to Splunk"
  value       = aws_kinesis_firehose_delivery_stream.splunk.name
}

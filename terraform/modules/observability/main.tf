resource "aws_kinesis_firehose_delivery_stream" "splunk" {
  name        = "${var.name}-splunk"
  destination = "splunk"

  splunk_configuration {
    hec_endpoint              = var.splunk_endpoint
    hec_token                 = var.splunk_hec_token
    hec_acknowledgment_timeout = 600
    retry_duration             = 300
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_subscription_filter" "splunk" {
  for_each = toset(var.log_groups)

  name            = "${var.name}-splunk-${replace(each.value, "/", "-")}"
  log_group_name  = each.value
  filter_pattern  = ""
  destination_arn = aws_kinesis_firehose_delivery_stream.splunk.arn
}

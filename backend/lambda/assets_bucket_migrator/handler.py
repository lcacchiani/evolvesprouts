"""CloudFormation custom resource to copy legacy asset objects to the new bucket."""

from __future__ import annotations

from typing import Any, Mapping

from botocore.exceptions import ClientError

from app.services.aws_clients import get_s3_client
from app.utils.cfn_response import send_cfn_response
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Copy current objects from the legacy client-assets bucket into AssetsBucket."""
    request_type = str(event.get("RequestType", ""))
    physical_id = str(event.get("PhysicalResourceId") or "assets-bucket-migration")

    if request_type == "Delete":
        data = {"status": "skipped", "reason": "delete"}
        send_cfn_response(event, context, "SUCCESS", data, physical_id)
        return {"PhysicalResourceId": physical_id, "Data": data}

    try:
        properties = event.get("ResourceProperties") or {}
        source_bucket = _require_property(properties, "SourceBucketName")
        destination_bucket = _require_property(properties, "DestinationBucketName")
        physical_id = f"assets-bucket-migration-{destination_bucket}"

        if source_bucket == destination_bucket:
            data = {"status": "skipped", "reason": "same_bucket"}
            send_cfn_response(event, context, "SUCCESS", data, physical_id)
            return {"PhysicalResourceId": physical_id, "Data": data}

        if not _bucket_exists(source_bucket):
            data = {"status": "skipped", "reason": "source_missing"}
            send_cfn_response(event, context, "SUCCESS", data, physical_id)
            return {"PhysicalResourceId": physical_id, "Data": data}

        copied_objects = _copy_objects(source_bucket, destination_bucket)
        data = {"status": "ok", "copied_objects": copied_objects}
        send_cfn_response(event, context, "SUCCESS", data, physical_id)
        return {"PhysicalResourceId": physical_id, "Data": data}
    except Exception:
        logger.exception("Assets bucket migration failed")
        data = {"status": "failed"}
        send_cfn_response(
            event,
            context,
            "FAILED",
            data,
            physical_id,
            "Assets bucket migration failed",
        )
        return {"PhysicalResourceId": physical_id, "Data": data}


def _bucket_exists(bucket_name: str) -> bool:
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=bucket_name)
        return True
    except ClientError as exc:
        error_code = str(exc.response.get("Error", {}).get("Code", ""))
        if error_code in {"404", "NoSuchBucket", "NotFound"}:
            return False
        raise


def _copy_objects(source_bucket: str, destination_bucket: str) -> int:
    client = get_s3_client()
    paginator = client.get_paginator("list_objects_v2")
    copied_objects = 0

    for page in paginator.paginate(Bucket=source_bucket):
        for entry in page.get("Contents", []):
            key = str(entry.get("Key") or "").strip()
            if not key:
                continue
            client.copy_object(
                Bucket=destination_bucket,
                Key=key,
                CopySource={"Bucket": source_bucket, "Key": key},
                MetadataDirective="COPY",
                TaggingDirective="COPY",
            )
            copied_objects += 1

    logger.info(
        "Assets bucket migration completed",
        extra={
            "source_bucket": source_bucket,
            "destination_bucket": destination_bucket,
            "copied_objects": copied_objects,
        },
    )
    return copied_objects


def _require_property(properties: Mapping[str, Any], key: str) -> str:
    value = str(properties.get(key) or "").strip()
    if not value:
        raise ValueError(f"Missing required property: {key}")
    return value

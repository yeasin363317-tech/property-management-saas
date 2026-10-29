#!/usr/bin/env bash
set -euo pipefail

schema="database/schema.sql"
indexes=(
  idx_maintenance_requests_assigned_to
  idx_maintenance_requests_tenant
  idx_maintenance_requests_property
  idx_documents_uploaded_by
  idx_support_tickets_created_by
  idx_support_tickets_assigned_to
  idx_support_tickets_org
  idx_audit_logs_actor
  idx_leases_unit
  idx_rent_invoices_lease
  idx_expenses_property
  idx_invitations_tenant
)

for index in "${indexes[@]}"; do
  if ! grep -q "${index}" "$schema"; then
    echo "Missing foreign-key index in ${schema}: ${index}" >&2
    exit 1
  fi
done

if ! grep -q "migrations (001-009)" "$schema"; then
  echo "Schema source marker is stale; expected migrations 001-009." >&2
  exit 1
fi

echo "Schema parity checks passed: migration marker and all audit-listed FK indexes are present."

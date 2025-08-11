#!/usr/bin/env bash
set -euo pipefail

# Creates/links a Project called "HookRelay Roadmap", adds fields, and adds seeded issues.
# Prereqs: gh authenticated with scopes: project, read:project

owner=$(gh repo view --json owner -q .owner.login)
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
project_title="HookRelay Roadmap"

echo "Owner: $owner"
echo "Repo:  $repo"

echo "Finding or creating project: $project_title"
proj_number=$(gh project list --owner "$owner" --format json -q ".projects[] | select(.title == \"$project_title\") | .number" | head -n1)
if [[ -z "${proj_number:-}" ]]; then
  proj_number=$(gh project create --owner "$owner" --title "$project_title" --format json -q .number)
  echo "Created project number: $proj_number"
else
  echo "Found existing project number: $proj_number"
fi

echo "Linking repository to project"
gh project link "$proj_number" --owner "$owner" --repo "${repo#*/}" || true

field_id() { gh project field-list "$proj_number" --owner "$owner" --format json -q ".fields[] | select(.name == \"$1\") | .id" | head -n1; }

ensure_select_field() {
  local name="$1"; shift
  local -a opts=("$@")
  if fid=$(field_id "$name") && [[ -n "${fid:-}" ]]; then echo "Field '$name' exists"; return; fi
  local args=(project field-create "$proj_number" --owner "$owner" --name "$name" --data-type SINGLE_SELECT)
  for o in "${opts[@]}"; do args+=(--single-select-options "$o"); done
  gh "${args[@]}" >/dev/null
  echo "Created field '$name'"
}

ensure_date_field() {
  local name="$1"
  if fid=$(field_id "$name") && [[ -n "${fid:-}" ]]; then echo "Field '$name' exists"; return; fi
  gh project field-create "$proj_number" --owner "$owner" --name "$name" --data-type DATE >/dev/null
  echo "Created field '$name'"
}

ensure_select_field "Area" infra api console alerts billing testing docs
ensure_select_field "Priority" P0 P1 P2 P3
ensure_date_field "Target"

titles=$(cat <<'EOF'
Infra: Terraform scaffold + core AWS
Ingest handler: HMAC (Stripe/GitHub/generic) + idempotency
Delivery worker: POST to receiver + classification
Backoff scheduler: SQS + EventBridge
DLQ: Persist exhausted attempts to S3
Replay API + worker
Alerts: Slack + SES
Console MVP: endpoints, deliveries, replay
Stripe metering: usage records
Load + fault tests; runbooks
EOF
)

issues_json=$(gh issue list -R "$repo" --limit 200 --state open --json number,title,url)

added=0
while IFS= read -r t; do
  url=$(jq -r --arg t "$t" '.[] | select(.title == $t) | .url' <<<"$issues_json" | head -n1)
  if [[ -n "$url" && "$url" != "null" ]]; then
    gh project item-add "$proj_number" --owner "$owner" --url "$url" >/dev/null
    echo "Added to project: $t"
    added=$((added+1))
  else
    echo "Not found (skipped): $t"
  fi
done <<< "$titles"

echo
echo "Project $project_title (#$proj_number) linked and $added issues added."

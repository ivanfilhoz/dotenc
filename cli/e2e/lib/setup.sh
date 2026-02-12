#!/bin/bash
# Setup helpers for e2e tests

CLI_PATH="/app/cli/src/cli.ts"

generate_ed25519_key() {
    local home_dir="$1"
    mkdir -p "$home_dir/.ssh"
    ssh-keygen -t ed25519 -f "$home_dir/.ssh/id_ed25519" -N "" -q
}

generate_rsa_key() {
    local home_dir="$1"
    mkdir -p "$home_dir/.ssh"
    ssh-keygen -t rsa -b 2048 -f "$home_dir/.ssh/id_rsa" -N "" -q
}

run_cli() {
    local home_dir="$1"
    local workspace="$2"
    shift 2
    (cd "$workspace" && HOME="$home_dir" tsx "$CLI_PATH" "$@")
}

create_mock_editor() {
    local content="$1"
    local content_file
    content_file=$(mktemp /tmp/mock-editor-content-XXXXXX)
    printf '%s\n' "$content" > "$content_file"

    local script_file
    script_file=$(mktemp /tmp/mock-editor-XXXXXX.sh)

    cat > "$script_file" <<EOF
#!/bin/bash
FILE="\$1"
{
    sed -n '1,/^# ---\$/p' "\$FILE"
    cat "$content_file"
} > "\${FILE}.tmp"
mv "\${FILE}.tmp" "\$FILE"
EOF

    chmod +x "$script_file"
    echo "$script_file"
}

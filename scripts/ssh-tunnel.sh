#!/bin/bash
# SSH Tunnel Management Script
# Manages SSH tunnel for remote database connection

set -e

# Default SSH tunnel configuration (can be overridden by .env)
SSH_HOST="${SSH_TUNNEL_HOST:-95.216.154.45}"
SSH_PORT="${SSH_TUNNEL_PORT:-522}"
SSH_USER="${SSH_TUNNEL_USER:-dbssh}"
LOCAL_PORT="${SSH_TUNNEL_LOCAL_PORT:-3306}"
REMOTE_HOST="${SSH_TUNNEL_REMOTE_HOST:-127.0.0.1}"
REMOTE_PORT="${SSH_TUNNEL_REMOTE_PORT:-3306}"
PID_FILE="${SSH_TUNNEL_PID_FILE:-.ssh-tunnel.pid}"

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep -E '^SSH_TUNNEL_' | xargs)
fi

# Function to check if tunnel is running
is_tunnel_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        else
            # PID file exists but process is dead, clean it up
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# Function to find tunnel process by port
find_tunnel_by_port() {
    lsof -ti:$LOCAL_PORT 2>/dev/null || echo ""
}

# Function to start the tunnel
start_tunnel() {
    if is_tunnel_running; then
        PID=$(cat "$PID_FILE")
        echo "✅ SSH tunnel is already running (PID: $PID)"
        return 0
    fi
    
    # Check if port is already in use
    EXISTING_PID=$(find_tunnel_by_port)
    if [ -n "$EXISTING_PID" ]; then
        echo "⚠️  Port $LOCAL_PORT is already in use (PID: $EXISTING_PID)"
        echo "   This might be another SSH tunnel. Use 'npm run tunnel:stop' to stop it."
        return 1
    fi
    
    echo "🚀 Starting SSH tunnel..."
    echo "   Local port: $LOCAL_PORT"
    echo "   Remote: $REMOTE_HOST:$REMOTE_PORT"
    echo "   SSH: $SSH_USER@$SSH_HOST:$SSH_PORT"
    
    # Start SSH tunnel in background
    ssh -f -N -L $LOCAL_PORT:$REMOTE_HOST:$REMOTE_PORT -p $SSH_PORT $SSH_USER@$SSH_HOST
    
    # Find the PID of the tunnel process
    sleep 1
    TUNNEL_PID=$(find_tunnel_by_port)
    
    if [ -n "$TUNNEL_PID" ]; then
        echo "$TUNNEL_PID" > "$PID_FILE"
        echo "✅ SSH tunnel started successfully (PID: $TUNNEL_PID)"
        echo "   Tunnel is running in the background"
        return 0
    else
        echo "❌ Failed to start SSH tunnel"
        return 1
    fi
}

# Function to stop the tunnel
stop_tunnel() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "🛑 Stopping SSH tunnel (PID: $PID)..."
            kill "$PID" 2>/dev/null || true
            rm -f "$PID_FILE"
            echo "✅ SSH tunnel stopped"
            return 0
        else
            echo "⚠️  PID file exists but process is not running. Cleaning up..."
            rm -f "$PID_FILE"
        fi
    fi
    
    # Also check for any process using the port
    EXISTING_PID=$(find_tunnel_by_port)
    if [ -n "$EXISTING_PID" ]; then
        echo "🛑 Found process using port $LOCAL_PORT (PID: $EXISTING_PID). Stopping..."
        kill "$EXISTING_PID" 2>/dev/null || true
        echo "✅ Process stopped"
        return 0
    fi
    
    echo "ℹ️  No SSH tunnel is running"
    return 0
}

# Function to check tunnel status
check_tunnel() {
    if is_tunnel_running; then
        PID=$(cat "$PID_FILE")
        echo "✅ SSH tunnel is running (PID: $PID)"
        echo "   Local port: $LOCAL_PORT"
        echo "   Remote: $REMOTE_HOST:$REMOTE_PORT"
        echo "   SSH: $SSH_USER@$SSH_HOST:$SSH_PORT"
        return 0
    else
        echo "❌ SSH tunnel is not running"
        return 1
    fi
}

# Main command handler
case "${1:-}" in
    start)
        start_tunnel
        ;;
    stop)
        stop_tunnel
        ;;
    status|check)
        check_tunnel
        ;;
    restart)
        stop_tunnel
        sleep 1
        start_tunnel
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the SSH tunnel in the background"
        echo "  stop    - Stop the SSH tunnel"
        echo "  status  - Check if the tunnel is running"
        echo "  restart - Restart the tunnel"
        echo ""
        echo "Configuration (can be set in .env):"
        echo "  SSH_TUNNEL_HOST         - SSH server host (default: $SSH_HOST)"
        echo "  SSH_TUNNEL_PORT         - SSH server port (default: $SSH_PORT)"
        echo "  SSH_TUNNEL_USER         - SSH username (default: $SSH_USER)"
        echo "  SSH_TUNNEL_LOCAL_PORT   - Local port (default: $LOCAL_PORT)"
        echo "  SSH_TUNNEL_REMOTE_HOST  - Remote MySQL host (default: $REMOTE_HOST)"
        echo "  SSH_TUNNEL_REMOTE_PORT  - Remote MySQL port (default: $REMOTE_PORT)"
        exit 1
        ;;
esac


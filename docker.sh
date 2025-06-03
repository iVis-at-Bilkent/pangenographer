#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${2}${1}${NC}"
}

# Function to check if a command succeeded
check_status() {
    if [ $? -eq 0 ]; then
        print_message "✓ $1" "$GREEN"
    else
        print_message "✗ $1" "$RED"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -c, --clean    Clean up all Docker resources before starting"
    echo "  -b, --build    Build the images before starting"
    echo "  -s, --start    Start the containers"
    echo "  -a, --all      Clean, build, and start (default behavior)"
}

# Default values
CLEAN=false
BUILD=false
START=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -b|--build)
            BUILD=true
            shift
            ;;
        -s|--start)
            START=true
            shift
            ;;
        -a|--all)
            CLEAN=true
            BUILD=true
            START=true
            shift
            ;;
        *)
            print_message "Unknown option: $1" "$RED"
            show_help
            exit 1
            ;;
    esac
done

# If no specific options are provided, run everything
if [ "$CLEAN" = false ] && [ "$BUILD" = false ] && [ "$START" = false ]; then
    CLEAN=true
    BUILD=true
    START=true
fi

# Cleanup function
cleanup() {
    if [ "$CLEAN" = true ]; then
        print_message "Cleaning up Docker resources..." "$YELLOW"
        
        # Stop all running containers
        print_message "Stopping containers..." "$YELLOW"
        docker stop $(docker ps -q) 2>/dev/null || true
        check_status "Stopped containers"
        
        # Remove all containers
        print_message "Removing containers..." "$YELLOW"
        docker rm -f $(docker ps -aq) 2>/dev/null || true
        check_status "Removed containers"
        
        # Remove all images
        print_message "Removing images..." "$YELLOW"
        docker rmi -f $(docker images -q) 2>/dev/null || true
        check_status "Removed images"
        
        # Remove all volumes
        print_message "Removing volumes..." "$YELLOW"
        docker volume rm -f $(docker volume ls -q) 2>/dev/null || true
        check_status "Removed volumes"
        
        # Remove all user-defined networks
        print_message "Removing networks..." "$YELLOW"
        docker network rm $(docker network ls | awk '$2 != "bridge" && $2 != "host" && $2 != "none" {print $1}') 2>/dev/null || true
        check_status "Removed networks"
        
        # Remove all types of cache
        print_message "Removing all Docker cache..." "$YELLOW"
        # Remove build cache
        docker builder prune -af
        # Remove image cache
        docker image prune -af
        # Remove container cache
        docker container prune -f
        # Remove network cache
        docker network prune -f
        # Remove volume cache
        docker volume prune -f
        check_status "Removed all Docker cache"
        
        # Final system prune
        print_message "Final system prune..." "$YELLOW"
        # Prune system with filter
        docker system prune -af --filter "until=0s"
        # Prune volumes separately
        docker system prune -af --volumes
        check_status "System prune completed"
    fi
}

# Build function
build() {
    if [ "$BUILD" = true ]; then
        print_message "Building images without cache..." "$YELLOW"
        docker compose build --no-cache
        check_status "Images built"
    fi
}

# Start function
start() {
    if [ "$START" = true ]; then
        print_message "Starting containers..." "$YELLOW"
        docker compose up -d
        check_status "Containers started"
        
        # Show container status
        print_message "\nContainer Status:" "$GREEN"
        docker compose ps
    fi
}

# Main execution
cleanup
build
start

print_message "\nDone! 🚀" "$GREEN"
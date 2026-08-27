output=$(sudo netstat -tulnpe)
nextserver=$(echo "$output" | grep ':3001')
websocketserver=$(echo "$output" | grep ':4001')

pid_ns=$(echo "$nextserver" | awk -F'/' '{print $1}' | awk '{print $NF}')
pid_ws=$(echo "$websocketserver" | awk -F'/' '{print $1}' | awk '{print $NF}')

# Check if we got a PID on next server
if [[ -z "$pid_ns" ]]; then
    echo "No process found listening on port 3001."
else
    echo "Killing process $pid_ns on port 3001."
    sudo kill "$pid_ns"
fi

# Check if we got a PID on websocket-server
if [[ -z "$pid_ws" ]]; then
    echo "No process found listening on port 4001."
else
    echo "Killing process $pid_ws on port 4001."
    sudo kill "$pid_ws"
fi

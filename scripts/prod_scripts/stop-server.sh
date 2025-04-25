output=$(sudo netstat -tulnpe)
nextserver=$(echo "$output" | grep ':3000')
websocketserver=$(echo "$output" | grep ':4000')

pid_ns=$(echo "$nextserver" | awk -F'/' '{print $1}' | awk '{print $NF}')
pid_ws=$(echo "$websocketserver" | awk -F'/' '{print $1}' | awk '{print $NF}')

# Check and kill process on port 3000
if [[ -z "$pid_ns" ]]; then
    echo "No process found listening on port 3000."
else
    echo "Killing process $pid_ns on port 3000."
    sudo kill "$pid_ns"
fi

# Check and kill process on port 4000
if [[ -z "$pid_ws" ]]; then
    echo "No process found listening on port 4000."
else
    echo "Killing process $pid_ws on port 4000."
    sudo kill "$pid_ws"
fi

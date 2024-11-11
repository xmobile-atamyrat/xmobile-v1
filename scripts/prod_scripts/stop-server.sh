output=$(sudo netstat -tulnpe | grep ':3000')

pid=$(echo "$output" | awk -F'/' '{print $1}' | awk '{print $NF}')

# Check if we got a PID
if [[ -z "$pid" ]]; then
    echo "No process found listening on port 3000."
else
    echo "Killing process $pid on port 3000."
    sudo kill "$pid"
fi

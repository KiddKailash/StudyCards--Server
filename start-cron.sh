#!/bin/sh

# 1. Export all runtime environment variables so cron can see them
#    - Exclude "no_proxy" if you like (some distros do by default)
printenv | grep -v "no_proxy" >> /etc/environment

# 2. Start cron in the background
cron

# 3. Start your main server
node server.js

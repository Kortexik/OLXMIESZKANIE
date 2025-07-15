#!/bin/bash
echo "Running at $(date)" >> /home/login/OLXMIESZKANIE/scraper.log
cd /home/login/OLXMIESZKANIE || exit 1
/usr/bin/node /home/login/OLXMIESZKANIE/src/main.js >> /home/login/OLXMIESZKANIE/scraper.log 2>&1
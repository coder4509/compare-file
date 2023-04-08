#!bin/bash
npm install -g pm2;

npm install;

npm run prod-build;

serverHost=`hostname`;
echo "check server PORT in .env";
echo "Application successfully running on $serverHost:5000";
#!/bin/bash
#git reset --hard origin/master
#git pull origin master

rm -rf node_modules
rm -rf dist

yarn set version stable
yarn install
yarn build

# pm2 startOrRestart pm2.json
pm2 reload pm2.json
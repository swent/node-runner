FROM node:lts-stretch

# Create app directory
WORKDIR /usr/src/app

# Copy app
COPY package.json ./
COPY *.js ./

# Restore packages
RUN npm install

# Open http port
EXPOSE 8080

# Run app
CMD [ "npm", "start" ]

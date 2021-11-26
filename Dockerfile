FROM node:lts-alpine

# Install python
RUN apk add --no-cache python3
RUN ln -s /usr/bin/python3 /usr/bin/python

# Create directories
WORKDIR /tmp/app
RUN mkdir -p /usr/src/dropins

# Copy app to temp location
COPY package.json ./
COPY *.js ./

# Restore packages
RUN npm install

# Set correct workdir for startup
WORKDIR /usr/src/app

# Open http port
EXPOSE 8080

# Run app
CMD cp -a /tmp/app/. ./ && npm start

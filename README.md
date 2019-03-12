# node-runner
Docker container that let's you drop-in node applications to auto-run them on the fly.
Turbo charge hosting your little scripts and crawlers.

node:lts-stretch is used as container base.

Docker run params:
-v /host/dropins/path:/usr/src/app/dropins
-p xxxx:8080 http the node proxy listens on

Drop-in apps should generally consist of a folder containing the package.json and other relevant resources.
A package.json is required since "npm install" is a mandatory step in preparing any app for start-up.
Any drop-in app needs to define the "start" script in their package.json to make it run.
If an application encounters an error or exits, it will be restarted after a few seconds (infinitly).


Have fun.

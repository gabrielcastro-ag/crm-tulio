module.exports = {
    apps: [
        {
            name: "mudashape-ai-server",
            script: "/root/mudashape-scheduler/services/server.ts",
            cwd: "/root/mudashape-scheduler",
            interpreter: "node",
            interpreter_args: "--import /root/mudashape-scheduler/node_modules/tsx/dist/loader.mjs",
            env: {
                NODE_ENV: "production",
            },
        },
        {
            name: "mudashape-scheduler",
            script: "/root/mudashape-scheduler/services/scheduler.ts",
            cwd: "/root/mudashape-scheduler",
            interpreter: "node",
            interpreter_args: "--import /root/mudashape-scheduler/node_modules/tsx/dist/loader.mjs",
            env: {
                NODE_ENV: "production",
            },
        }
    ]
};

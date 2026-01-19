module.exports = {
    apps: [
        {
            name: "mudashape-ai-server",
            script: "services/server.ts",
            interpreter: "node",
            interpreter_args: "--import tsx",
            env: {
                NODE_ENV: "production",
            },
        },
        {
            name: "mudashape-scheduler",
            script: "services/scheduler.ts",
            interpreter: "node",
            interpreter_args: "--import tsx",
            env: {
                NODE_ENV: "production",
            },
        }
    ]
};

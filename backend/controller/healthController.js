const db = require("../config/db");
const os = require("os");

const getHealthStatus = async (req, res) => {
    const healthStatus = {
        status: "UP",
        timestamp: new Date().toISOString(),
        services: {
            database: {
                status: "UNKNOWN"
            },
            system: {
                uptime: os.uptime(),
                memory: {
                    free: os.freemem(),
                    total: os.totalmem(),
                    usagePercentage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
                },
                cpu: {
                    loadavg: os.loadavg()
                }
            }
        }
    };

    try {
        // Run a simple query to verify database connectivity (via ProxySQL)
        await db.query("SELECT 1");
        healthStatus.services.database.status = "UP";
        return res.status(200).json(healthStatus);
    } catch (error) {
        healthStatus.status = "DOWN";
        healthStatus.services.database.status = "DOWN";
        healthStatus.services.database.error = error.message;
        return res.status(500).json(healthStatus);
    }
};

module.exports = { getHealthStatus };

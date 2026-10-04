
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import dns from "dns";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
 * Load backend/.env before importing the migration service.
 */
dotenv.config({
    path: path.resolve(__dirname, "../.env"),
});

/*
 * MongoDB Atlas SRV resolution on the local DNS resolver
 * returns EBADRESP.
 *
 * Use reliable public DNS servers for this READ-ONLY audit.
 */
dns.setServers([
    "8.8.8.8",
    "1.1.1.1",
]);

async function main() {
    /*
     * Import after environment variables and DNS are configured.
     */
    const {
        auditTutorMigration,
    } = await import(
        "../utils/tutorMigrationService.js"
    );

    console.log("");
    console.log(
        "============================================================"
    );
    console.log(
        "Saraswati Tutorials - Tutor Migration Audit"
    );
    console.log(
        "============================================================"
    );
    console.log("Mode: READ-ONLY");
    console.log("");

    console.log(
        "[Audit Runner] DNS servers:"
    );
    console.log("  - 8.8.8.8");
    console.log("  - 1.1.1.1");
    console.log("");

    if (!process.env.MONGO_URI) {
        throw new Error(
            "MONGO_URI is not configured in backend/.env."
        );
    }

    console.log(
        "[Audit Runner] Connecting to MongoDB..."
    );

    await mongoose.connect(
        process.env.MONGO_URI,
        {
            bufferCommands: false,
        }
    );

    console.log(
        "[Audit Runner] MongoDB connected."
    );
    console.log("");

    try {
        const report =
            await auditTutorMigration();

        const timestamp =
            new Date()
                .toISOString()
                .replace(
                    /[:.]/g,
                    "-"
                );

        const reportDirectory =
            path.resolve(
                __dirname,
                "../reports"
            );

        await fs.mkdir(
            reportDirectory,
            {
                recursive: true,
            }
        );

        const reportPath =
            path.join(
                reportDirectory,
                `tutor-migration-audit-v2-${timestamp}.json`
            );

        await fs.writeFile(
            reportPath,
            JSON.stringify(
                report,
                null,
                2
            ),
            "utf8"
        );

        console.log("");
        console.log(
            "============================================================"
        );
        console.log(
            "AUDIT V2 COMPLETE"
        );
        console.log(
            "============================================================"
        );

        console.log(
            `MongoDB tutors       : ${report.summary.mongoTutorCount}`
        );

        console.log(
            `Odoo tutors          : ${report.summary.odooTutorCount}`
        );

        console.log(
            `Already in Odoo      : ${report.summary.alreadyInOdoo}`
        );

        console.log(
            `Migration candidates : ${report.summary.migrationCandidates}`
        );

        console.log(
            `Manual review        : ${report.summary.manualReview}`
        );

        console.log(
            `Identity conflicts   : ${report.summary.identityConflicts}`
        );

        console.log(
            `Invalid              : ${report.summary.invalid}`
        );

        console.log(
            `Test data            : ${report.summary.testData}`
        );

        console.log(
            `Mongo duplicate groups: ${report.summary.mongoDuplicateGroups}`
        );

        console.log(
            `Odoo duplicate groups : ${report.summary.odooDuplicateGroups}`
        );

        console.log("");
        console.log(
            `Migration eligible   : ${report.summary.migrationEligible}`
        );

        console.log("");
        console.log(
            "Report saved to:"
        );

        console.log(reportPath);

        console.log("");
        console.log(
            "No MongoDB or Odoo records were modified."
        );
    } finally {
        await mongoose.disconnect();

        console.log(
            "[Audit Runner] MongoDB connection closed."
        );
    }
}

main().catch(error => {
    console.error("");
    console.error(
        "============================================================"
    );
    console.error(
        "AUDIT V2 FAILED"
    );
    console.error(
        "============================================================"
    );

    console.error(
        error.message
    );

    console.error("");

    process.exitCode = 1;
});

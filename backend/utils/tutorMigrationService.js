
import dotenv from "dotenv";
import Tutor from "../models/Tutor.js";
import { callOdoo } from "./odooService.js";

dotenv.config();

/* ============================================================
   NORMALIZATION
   ============================================================ */

function normalizeString(value) {
    if (
        value === null ||
        value === undefined ||
        value === false
    ) {
        return "";
    }

    return String(value)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function normalizeEmail(value) {
    const email = normalizeString(value);

    if (
        !email ||
        email === "false" ||
        email === "null" ||
        email === "undefined"
    ) {
        return "";
    }

    return email;
}

function normalizeTutorCode(value) {
    return normalizeString(value).replace(
        /[^a-z0-9]/g,
        ""
    );
}

function normalizePhone(value) {
    if (
        value === null ||
        value === undefined ||
        value === false
    ) {
        return "";
    }

    let digits = String(value).replace(/\D/g, "");

    if (digits.startsWith("91") && digits.length === 12) {
        digits = digits.slice(2);
    }

    if (digits.startsWith("0") && digits.length === 11) {
        digits = digits.slice(1);
    }

    return digits;
}

function isValidPhone(phone) {
    return /^\d{10}$/.test(phone);
}

function isPlaceholder(value) {
    const normalized = normalizeString(value);

    if (!normalized) {
        return false;
    }

    const placeholders = [
        "test",
        "test tutor",
        "testing",
        "integration test",
        "integration test tutor",
        "test fix tutor submission",
        "dummy",
        "dummy tutor",
        "sample",
        "sample tutor",
        "demo tutor",
        "chirag test",
    ];

    return placeholders.includes(normalized);
}

/* ============================================================
   IDENTITY EXTRACTION
   ============================================================ */

function getMongoIdentity(tutor) {
    return {
        mongoId: String(tutor._id || ""),
        tutorCode: normalizeTutorCode(tutor.tutorCode),
        phone: normalizePhone(tutor.phone),
        whatsapp: normalizePhone(tutor.whatsapp),
        email: normalizeEmail(tutor.email),
        name: normalizeString(tutor.name),
    };
}

function getOdooIdentity(tutor) {
    return {
        odooId: tutor.id,
        tutorCode: normalizeTutorCode(tutor.tutor_id),
        phone: normalizePhone(tutor.mobile),
        whatsapp: normalizePhone(tutor.whatsapp),
        email: normalizeEmail(tutor.email),
        name: normalizeString(tutor.name),
    };
}

/* ============================================================
   IDENTITY INDEXES
   ============================================================ */

function addToIndex(index, value, record) {
    if (!value) {
        return;
    }

    if (!index.has(value)) {
        index.set(value, []);
    }

    index.get(value).push(record);
}

function buildIdentityIndexes(records, identityGetter) {
    const indexes = {
        tutorCode: new Map(),
        phone: new Map(),
        whatsapp: new Map(),
        email: new Map(),
    };

    for (const record of records) {
        const identity = identityGetter(record);

        addToIndex(
            indexes.tutorCode,
            identity.tutorCode,
            record
        );

        addToIndex(
            indexes.phone,
            identity.phone,
            record
        );

        addToIndex(
            indexes.whatsapp,
            identity.whatsapp,
            record
        );

        addToIndex(
            indexes.email,
            identity.email,
            record
        );
    }

    return indexes;
}

/* ============================================================
   DUPLICATE DETECTION
   ============================================================ */

function findDuplicateGroups(records, identityGetter) {
    const indexes = buildIdentityIndexes(
        records,
        identityGetter
    );

    const duplicates = [];

    for (const [identifierType, index] of Object.entries(indexes)) {
        for (const [normalizedValue, matchingRecords] of index.entries()) {
            if (matchingRecords.length <= 1) {
                continue;
            }

            duplicates.push({
                identifierType,
                normalizedValue,
                recordIds: matchingRecords.map(
                    record => record.id || String(record._id)
                ),
                records: matchingRecords.map(record => {
                    const identity =
                        identityGetter(record);

                    return {
                        id:
                            identity.odooId ||
                            identity.mongoId ||
                            null,
                        tutorCode:
                            identity.tutorCode,
                        name:
                            identity.name,
                        phone:
                            identity.phone,
                        whatsapp:
                            identity.whatsapp,
                        email:
                            identity.email,
                    };
                }),
            });
        }
    }

    return duplicates;
}

/* ============================================================
   MONGO DUPLICATE DETECTION
   ============================================================ */

function findMongoDuplicateGroups(mongoTutors) {
    return findDuplicateGroups(
        mongoTutors,
        getMongoIdentity
    );
}

/* ============================================================
   ODOO DUPLICATE DETECTION
   ============================================================ */

function findOdooDuplicateGroups(odooTutors) {
    return findDuplicateGroups(
        odooTutors,
        getOdooIdentity
    );
}

/* ============================================================
   DATA QUALITY
   ============================================================ */

function validateIdentity(identity) {
    const issues = [];

    if (!identity.name) {
        issues.push("Missing name");
    }

    if (
        !identity.phone &&
        !identity.whatsapp &&
        !identity.email
    ) {
        issues.push(
            "No phone, WhatsApp or email"
        );
    }

    if (
        identity.phone &&
        !isValidPhone(identity.phone)
    ) {
        issues.push("Invalid phone");
    }

    if (
        identity.whatsapp &&
        !isValidPhone(identity.whatsapp)
    ) {
        issues.push("Invalid WhatsApp");
    }

    if (
        identity.email &&
        !identity.email.includes("@")
    ) {
        issues.push("Invalid email");
    }

    return issues;
}

/* ============================================================
   TEST DATA DETECTION
   ============================================================ */

function detectTestData(tutor, identity) {
    const reasons = [];

    if (isPlaceholder(identity.name)) {
        reasons.push(
            "Name appears to be test/placeholder data"
        );
    }

    if (
        identity.email.includes("example.com") ||
        identity.email.includes("example.org") ||
        identity.email.includes("example.net")
    ) {
        reasons.push(
            "Email uses an example domain"
        );
    }

    if (
        identity.email.includes("fixtutorsubmit")
    ) {
        reasons.push(
            "Email appears to belong to test data"
        );
    }

    if (
        identity.phone === "9123456789"
    ) {
        reasons.push(
            "Phone number appears to be test data"
        );
    }

    if (
        identity.phone === "9820098200"
    ) {
        reasons.push(
            "Phone number appears to belong to integration test data"
        );
    }

    if (
        tutor?.tutorCode &&
        normalizeTutorCode(tutor.tutorCode)
            .includes("e2e")
    ) {
        reasons.push(
            "Tutor code appears to be an end-to-end test record"
        );
    }

    return reasons;
}

/* ============================================================
   MATCHING
   ============================================================ */

function collectMatches(
    mongoIdentity,
    odooTutors,
    odooIndexes
) {
    const matches = new Map();

    const identifierChecks = [
        ["tutorCode", mongoIdentity.tutorCode],
        ["phone", mongoIdentity.phone],
        ["whatsapp", mongoIdentity.whatsapp],
        ["email", mongoIdentity.email],
    ];

    for (const [identifierType, value] of identifierChecks) {
        if (!value) {
            continue;
        }

        const records =
            odooIndexes[identifierType].get(value) || [];

        for (const record of records) {
            const odooIdentity =
                getOdooIdentity(record);

            if (!matches.has(odooIdentity.odooId)) {
                matches.set(
                    odooIdentity.odooId,
                    {
                        record,
                        identity: odooIdentity,
                        matchedIdentifiers: [],
                    }
                );
            }

            const match =
                matches.get(odooIdentity.odooId);

            if (
                !match.matchedIdentifiers.includes(
                    identifierType
                )
            ) {
                match.matchedIdentifiers.push(
                    identifierType
                );
            }
        }
    }

    return [...matches.values()];
}

function calculateConfidence(match) {
    const identifiers =
        match.matchedIdentifiers;

    if (
        identifiers.includes("tutorCode") &&
        identifiers.includes("phone") &&
        identifiers.includes("email")
    ) {
        return {
            level: "VERY_HIGH",
            score: 100,
            reason:
                "Tutor code, phone and email matched",
        };
    }

    if (
        identifiers.includes("tutorCode") &&
        identifiers.includes("phone")
    ) {
        return {
            level: "VERY_HIGH",
            score: 98,
            reason:
                "Tutor code and phone matched",
        };
    }

    if (
        identifiers.includes("tutorCode")
    ) {
        return {
            level: "HIGH",
            score: 95,
            reason:
                "Unique tutor code matched",
        };
    }

    if (
        identifiers.includes("phone") &&
        identifiers.includes("email")
    ) {
        return {
            level: "HIGH",
            score: 95,
            reason:
                "Phone and email matched",
        };
    }

    if (
        identifiers.includes("phone") ||
        identifiers.includes("whatsapp")
    ) {
        return {
            level: "HIGH",
            score: 90,
            reason:
                "Phone/WhatsApp matched",
        };
    }

    if (
        identifiers.includes("email")
    ) {
        return {
            level: "MEDIUM",
            score: 80,
            reason:
                "Email matched",
        };
    }

    return {
        level: "LOW",
        score: 0,
        reason:
            "No reliable identifier matched",
    };
}

/* ============================================================
   CONFLICT DETECTION
   ============================================================ */

function detectIdentityConflict(
    mongoIdentity,
    match
) {
    const conflicts = [];
    const odooIdentity = match.identity;

    if (
        mongoIdentity.phone &&
        odooIdentity.phone &&
        mongoIdentity.phone !== odooIdentity.phone
    ) {
        conflicts.push(
            "Phone differs between MongoDB and Odoo"
        );
    }

    if (
        mongoIdentity.whatsapp &&
        odooIdentity.whatsapp &&
        mongoIdentity.whatsapp !==
            odooIdentity.whatsapp
    ) {
        conflicts.push(
            "WhatsApp differs between MongoDB and Odoo"
        );
    }

    if (
        mongoIdentity.email &&
        odooIdentity.email &&
        mongoIdentity.email !== odooIdentity.email
    ) {
        conflicts.push(
            "Email differs between MongoDB and Odoo"
        );
    }

    return conflicts;
}

/* ============================================================
   MIGRATION ELIGIBILITY
   ============================================================ */

function evaluateMigrationCandidate(
    tutor,
    identity,
    mongoDuplicateGroups
) {
    const reasons = [];
    const blockers = [];

    const validationIssues =
        validateIdentity(identity);

    if (validationIssues.length > 0) {
        blockers.push(...validationIssues);
    }

    const testReasons =
        detectTestData(tutor, identity);

    if (testReasons.length > 0) {
        blockers.push(...testReasons);
    }

    const duplicateTutorCode =
        mongoDuplicateGroups.some(
            group =>
                group.identifierType ===
                    "tutorCode" &&
                group.normalizedValue ===
                    identity.tutorCode
        );

    if (
        duplicateTutorCode &&
        identity.tutorCode
    ) {
        blockers.push(
            "Mongo tutor code is duplicated"
        );
    }

    if (blockers.length > 0) {
        return {
            eligible: false,
            reasons,
            blockers,
        };
    }

    if (
        identity.phone ||
        identity.whatsapp ||
        identity.email
    ) {
        reasons.push(
            "No matching Odoo record found"
        );

        reasons.push(
            "At least one usable contact identifier exists"
        );

        return {
            eligible: true,
            reasons,
            blockers: [],
        };
    }

    return {
        eligible: false,
        reasons,
        blockers: [
            "No usable contact identifier",
        ],
    };
}

/* ============================================================
   RECONCILIATION
   ============================================================ */

function buildMongoSummary(tutor) {
    const identity =
        getMongoIdentity(tutor);

    return {
        id: identity.mongoId,
        tutorCode: identity.tutorCode,
        name: tutor.name || "",
        phone: identity.phone,
        whatsapp: identity.whatsapp,
        email: identity.email,

        status: tutor.status || "",
        availabilityStatus:
            tutor.availabilityStatus || "",
        verified:
            tutor.verified ?? null,
        onboardingCompleted:
            tutor.onboardingCompleted ?? null,
        odooLeadId:
            tutor.odooLeadId || "",
        odooSyncStatus:
            tutor.odooSyncStatus || "",
    };
}

function buildOdooSummary(record) {
    const identity =
        getOdooIdentity(record);

    return {
        id: identity.odooId,
        tutorCode: identity.tutorCode,
        name: record.name || "",
        phone: identity.phone,
        whatsapp: identity.whatsapp,
        email: identity.email,
    };
}

function reconcileMongoTutor(
    mongoTutor,
    odooTutors,
    odooIndexes,
    mongoDuplicateGroups
) {
    const mongoIdentity =
        getMongoIdentity(mongoTutor);

    const validationIssues =
        validateIdentity(mongoIdentity);

    const testReasons =
        detectTestData(
            mongoTutor,
            mongoIdentity
        );

    if (validationIssues.length > 0) {
        return {
            classification: "INVALID",
            migrationEligible: false,
            mongo:
                buildMongoSummary(mongoTutor),
            matches: [],
            reasons: validationIssues,
            blockers: validationIssues,
        };
    }

    const matches = collectMatches(
        mongoIdentity,
        odooTutors,
        odooIndexes
    );

    if (matches.length === 0) {
        const eligibility =
            evaluateMigrationCandidate(
                mongoTutor,
                mongoIdentity,
                mongoDuplicateGroups
            );

        if (testReasons.length > 0) {
            return {
                classification: "TEST_DATA",
                migrationEligible: false,
                mongo:
                    buildMongoSummary(mongoTutor),
                matches: [],
                reasons: testReasons,
                blockers: testReasons,
            };
        }

        if (
            eligibility.blockers.length > 0
        ) {
            return {
                classification: "MANUAL_REVIEW",
                migrationEligible: false,
                mongo:
                    buildMongoSummary(mongoTutor),
                matches: [],
                reasons:
                    eligibility.reasons,
                blockers:
                    eligibility.blockers,
            };
        }

        return {
            classification:
                "MIGRATION_CANDIDATE",
            migrationEligible: true,
            mongo:
                buildMongoSummary(mongoTutor),
            matches: [],
            reasons:
                eligibility.reasons,
            blockers: [],
        };
    }

    if (matches.length > 1) {
        return {
            classification:
                "MANUAL_REVIEW",
            migrationEligible: false,
            mongo:
                buildMongoSummary(mongoTutor),
            matches: matches.map(match => ({
                ...buildOdooSummary(
                    match.record
                ),
                matchedIdentifiers:
                    match.matchedIdentifiers,
                confidence:
                    calculateConfidence(match),
                conflicts:
                    detectIdentityConflict(
                        mongoIdentity,
                        match
                    ),
            })),
            reasons: [
                "Multiple Odoo records matched reliable identifiers",
            ],
            blockers: [
                "Requires manual identity resolution",
            ],
        };
    }

    const match = matches[0];

    const conflicts =
        detectIdentityConflict(
            mongoIdentity,
            match
        );

    if (conflicts.length > 0) {
        return {
            classification:
                "IDENTITY_CONFLICT",
            migrationEligible: false,
            mongo:
                buildMongoSummary(mongoTutor),
            odoo:
                buildOdooSummary(match.record),
            matchedIdentifiers:
                match.matchedIdentifiers,
            confidence:
                calculateConfidence(match),
            reasons: conflicts,
            blockers: conflicts,
        };
    }

    if (testReasons.length > 0) {
        return {
            classification: "TEST_DATA",
            migrationEligible: false,
            mongo:
                buildMongoSummary(mongoTutor),
            odoo:
                buildOdooSummary(match.record),
            matchedIdentifiers:
                match.matchedIdentifiers,
            confidence:
                calculateConfidence(match),
            reasons: testReasons,
            blockers: testReasons,
        };
    }

    return {
        classification:
            "ALREADY_IN_ODOO",
        migrationEligible: false,
        mongo:
            buildMongoSummary(mongoTutor),
        odoo:
            buildOdooSummary(match.record),
        matchedIdentifiers:
            match.matchedIdentifiers,
        confidence:
            calculateConfidence(match),
        reasons: [
            "Reliable Odoo identity match found",
            "No conflicting identifiers detected",
        ],
        blockers: [],
    };
}

/* ============================================================
   ODOO AUTHENTICATION
   ============================================================ */

async function authenticateOdoo() {
    const db = String(
        process.env.ODOO_DB ||
        "saraswati-tutorial"
    ).trim();

    const username = String(
        process.env.ODOO_USERNAME ||
        "admin"
    ).trim();

    const password = String(
        process.env.ODOO_PASSWORD ||
        ""
    ).trim();

    if (!password) {
        throw new Error(
            "ODOO_PASSWORD is not configured. Refusing to run the audit."
        );
    }

    const uid = await callOdoo(
        "common",
        "authenticate",
        [
            db,
            username,
            password,
            {},
        ]
    );

    if (
        !uid ||
        typeof uid !== "number"
    ) {
        throw new Error(
            "Odoo authentication failed."
        );
    }

    return {
        db,
        uid,
        password,
    };
}

/* ============================================================
   ODOO READ
   ============================================================ */

async function executeOdoo(
    auth,
    model,
    method,
    args = [],
    kwargs = {}
) {
    return callOdoo(
        "object",
        "execute_kw",
        [
            auth.db,
            auth.uid,
            auth.password,
            model,
            method,
            args,
            kwargs,
        ]
    );
}

async function fetchOdooMasterTutors(auth) {
    const fields = [
        "id",
        "tutor_id",
        "name",
        "gender",
        "mobile",
        "whatsapp",
        "email",
        "city",
        "area",
        "full_address",
        "pincode",
        "grades",
        "boards",
        "subjects",
        "preferred_timings",
        "max_travel_distance",
        "experience",
        "qualification",
        "availability",
        "locations_can_teach",
        "write_date",
    ];

    const limit = 500;
    let offset = 0;
    const records = [];

    while (true) {
        const batch =
            await executeOdoo(
                auth,
                "master_tutors",
                "search_read",
                [[]],
                {
                    fields,
                    limit,
                    offset,
                    order: "id asc",
                }
            );

        if (
            !Array.isArray(batch) ||
            batch.length === 0
        ) {
            break;
        }

        records.push(...batch);

        console.log(
            `[Tutor Audit] Read ${records.length} Odoo master_tutors records...`
        );

        if (
            batch.length < limit
        ) {
            break;
        }

        offset += limit;
    }

    return records;
}

/* ============================================================
   AUDIT
   ============================================================ */

export async function auditTutorMigration() {
    console.log(
        "============================================================"
    );
    console.log(
        "MongoDB -> Odoo Tutor Migration Audit v2"
    );
    console.log("READ-ONLY MODE");
    console.log(
        "============================================================"
    );

    if (!process.env.MONGO_URI) {
        throw new Error(
            "MONGO_URI is not configured. Refusing to run the audit."
        );
    }

    const auth =
        await authenticateOdoo();

    console.log(
        "[Tutor Audit] Loading MongoDB tutors..."
    );

    const mongoTutors =
        await Tutor.find({})
            .select({
                name: 1,
                phone: 1,
                email: 1,
                whatsapp: 1,
                tutorCode: 1,
                status: 1,
                availabilityStatus: 1,
                verified: 1,
                onboardingCompleted: 1,
                odooLeadId: 1,
                odooSyncStatus: 1,
            })
            .lean();

    console.log(
        `[Tutor Audit] MongoDB tutors found: ${mongoTutors.length}`
    );

    console.log(
        "[Tutor Audit] Loading Odoo master_tutors..."
    );

    const odooTutors =
        await fetchOdooMasterTutors(auth);

    console.log(
        `[Tutor Audit] Odoo master_tutors found: ${odooTutors.length}`
    );

    /* Duplicate analysis */

    const mongoDuplicateGroups =
        findMongoDuplicateGroups(
            mongoTutors
        );

    const odooDuplicateGroups =
        findOdooDuplicateGroups(
            odooTutors
        );

    /* Identity index */

    const odooIndexes =
        buildIdentityIndexes(
            odooTutors,
            getOdooIdentity
        );

    /* Reconciliation */

    const reconciliation =
        mongoTutors.map(
            mongoTutor =>
                reconcileMongoTutor(
                    mongoTutor,
                    odooTutors,
                    odooIndexes,
                    mongoDuplicateGroups
                )
        );

    /* Summary */

    const count =
        classification =>
            reconciliation.filter(
                item =>
                    item.classification ===
                    classification
            ).length;

    const summary = {
        mongoTutorCount:
            mongoTutors.length,

        odooTutorCount:
            odooTutors.length,

        alreadyInOdoo:
            count("ALREADY_IN_ODOO"),

        migrationCandidates:
            count("MIGRATION_CANDIDATE"),

        manualReview:
            count("MANUAL_REVIEW"),

        identityConflicts:
            count("IDENTITY_CONFLICT"),

        invalid:
            count("INVALID"),

        testData:
            count("TEST_DATA"),

        mongoDuplicateGroups:
            mongoDuplicateGroups.length,

        odooDuplicateGroups:
            odooDuplicateGroups.length,

        migrationEligible:
            reconciliation.filter(
                item =>
                    item.migrationEligible ===
                    true
            ).length,
    };

    return {
        generatedAt:
            new Date().toISOString(),

        mode: "READ_ONLY",

        auditVersion: "2.0",

        source: {
            mongoCollection:
                Tutor.collection.name,

            odooModel:
                "master_tutors",
        },

        summary,

        duplicateAnalysis: {
            mongo:
                mongoDuplicateGroups,

            odoo:
                odooDuplicateGroups,
        },

        reconciliation,

        migrationCandidates:
            reconciliation.filter(
                item =>
                    item.classification ===
                    "MIGRATION_CANDIDATE"
            ),

        manualReview:
            reconciliation.filter(
                item =>
                    item.classification ===
                        "MANUAL_REVIEW" ||
                    item.classification ===
                        "IDENTITY_CONFLICT"
            ),

        invalid:
            reconciliation.filter(
                item =>
                    item.classification ===
                    "INVALID"
            ),

        testData:
            reconciliation.filter(
                item =>
                    item.classification ===
                    "TEST_DATA"
            ),
    };
}

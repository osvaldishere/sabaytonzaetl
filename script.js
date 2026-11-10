let integratedData = [];

// Read CSV file
function readCSV(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve([]);
            return;
        }

        const reader = new FileReader();

        reader.onload = function(event) {
            try {
                const lines = event.target.result
                    .replace(/^\uFEFF/, "")
                    .trim()
                    .split(/\r?\n/);

                if (lines.length < 2) {
                    resolve([]);
                    return;
                }

                const headers = parseCSVLine(lines[0]);

                const records = lines.slice(1)
                    .filter(line => line.trim() !== "")
                    .map(line => {
                        const values = parseCSVLine(line);
                        const record = {};

                        headers.forEach((header, index) => {
                            record[header.trim()] =
                                (values[index] || "").trim();
                        });

                        return record;
                    });

                resolve(records);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

// Handles quoted CSV values
function parseCSVLine(line) {
    const result = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (insideQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === "," && !insideQuotes) {
            result.push(current);
            current = "";
        } else {
            current += char;
        }
    }

    result.push(current);
    return result;
}

// Proper case student names
function properCase(name) {
    return name.trim()
        .toLowerCase()
        .replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

// Program mapping
function mapProgram(code) {
    const programs = {
        BSIT: "Bachelor of Science in Information Technology",
        BSCS: "Bachelor of Science in Computer Science",
        BSIS: "Bachelor of Science in Information Systems"
    };

    return programs[code.trim().toUpperCase()] || code.trim().toUpperCase();
}

// Grade transformation
function transformGrade(grade) {
    const value = grade.trim();

    if (value === "") return null;

    if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value)) {
        return Number(value);
    }

    return value.toUpperCase();
}

// Completion status transformation
function normalizeStatus(status) {
    const value = status.trim().toLowerCase();

    if (!value) return null;

    return value.charAt(0).toUpperCase() + value.slice(1);
}

// Main integration function
async function processFiles() {
    try {
        const sisFile = document.getElementById("sisFile").files[0];
        const lmsFile = document.getElementById("lmsFile").files[0];
        const accountingFile =
            document.getElementById("accountingFile").files[0];

        if (!sisFile) {
            alert("Please upload the SIS CSV file.");
            return;
        }

        const [sis, lms, accounting] = await Promise.all([
            readCSV(sisFile),
            readCSV(lmsFile),
            readCSV(accountingFile)
        ]);

        // Index records by student ID
        const lmsMap = new Map(
            lms.map(record => [
                record.student_id.trim(),
                record
            ])
        );

        const accountingMap = new Map(
            accounting.map(record => [
                record.student_id.trim(),
                record
            ])
        );

        // Transform and integrate
        integratedData = sis.map(student => {
            const id = student.student_id.trim();

            const lmsRecord = lmsMap.get(id);
            const accountingRecord = accountingMap.get(id);

            const balance = accountingRecord?.account_balance?.trim();

            return {
                studentId: Number(id),

                studentName: properCase(
                    student.student_name
                ),

                program: mapProgram(
                    student.program_code
                ),

                emailAddress: student.email.trim().toLowerCase(),

                courseCode: lmsRecord?.course_code
                    ? lmsRecord.course_code.trim().toUpperCase()
                    : null,

                finalGrade: lmsRecord
                    ? transformGrade(lmsRecord.final_grade)
                    : null,

                completionStatus: lmsRecord
                    ? normalizeStatus(lmsRecord.completion_status)
                    : null,

                outstandingBalance:
                    balance !== undefined && balance !== ""
                        ? Number(balance)
                        : null,

                currency: accountingRecord?.currency
                    ? accountingRecord.currency.trim().toUpperCase()
                    : null
            };
        });

        displayResults(sis, lms, accounting);

    } catch (error) {
        console.error(error);
        alert("Error processing CSV files. Please check the file format.");
    }
}

// Display JSON and summary
function displayResults(sis, lms, accounting) {
    document.getElementById("jsonOutput").textContent =
        JSON.stringify(integratedData, null, 4);

    const matchedLMS = integratedData.filter(
        student => student.courseCode !== null
    ).length;

    const matchedAccounting = integratedData.filter(
        student => student.outstandingBalance !== null
    ).length;

    document.getElementById("summary").innerHTML = `
        <strong>Total SIS Students:</strong> ${sis.length}<br>
        <strong>Total LMS Records:</strong> ${lms.length}<br>
        <strong>Total Accounting Records:</strong> ${accounting.length}<br>
        <strong>Students with LMS Data:</strong> ${matchedLMS}<br>
        <strong>Students without LMS Data:</strong>
            ${sis.length - matchedLMS}<br>
        <strong>Students with Accounting Data:</strong>
            ${matchedAccounting}<br>
        <strong>Students without Accounting Data:</strong>
            ${sis.length - matchedAccounting}
    `;
}

// Download JSON file
function downloadJSON() {
    if (integratedData.length === 0) {
        alert("Please process the CSV files first.");
        return;
    }

    const blob = new Blob(
        [JSON.stringify(integratedData, null, 4)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "integrated_student_data.json";

    link.click();

    URL.revokeObjectURL(url);
}
/**
 * Debug script to check users and SOWs
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function debug() {
    console.log('\n========== USERS IN FIRESTORE ==========\n');

    const usersSnapshot = await db.collection('users').get();
    console.log(`Total users: ${usersSnapshot.size}\n`);

    usersSnapshot.forEach(doc => {
        const user = doc.data();
        console.log(`- ${user.email || user.phoneNumber || doc.id}`);
        console.log(`  UID: ${user.uid}`);
        console.log(`  Email: ${user.email || 'none'}`);
        console.log(`  Phone: ${user.phoneNumber || 'none'}`);
        console.log('');
    });

    console.log('\n========== SOW DOCUMENTS ==========\n');

    const sowsSnapshot = await db.collection('sow_documents').get();
    console.log(`Total SOWs: ${sowsSnapshot.size}\n`);

    sowsSnapshot.forEach(doc => {
        const sow = doc.data();
        console.log(`- ${sow.clientName || doc.id}`);
        console.log(`  Client Email: ${sow.clientEmail || 'none'}`);
        console.log(`  Client Phone: ${sow.clientPhone || 'none'}`);
        console.log('');
    });

    console.log('\n========== USERS WITHOUT SOW ==========\n');

    // Build sets of emails and phones that have SOWs
    const sowEmails = new Set();
    const sowPhones = new Set();

    sowsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.clientEmail) {
            sowEmails.add(data.clientEmail.toLowerCase().trim());
        }
        if (data.clientPhone) {
            sowPhones.add(data.clientPhone);
        }
    });

    console.log('SOW Emails:', [...sowEmails]);
    console.log('SOW Phones:', [...sowPhones]);
    console.log('');

    // Filter users who don't have a SOW
    let count = 0;
    usersSnapshot.forEach(doc => {
        const user = doc.data();
        const userEmail = user.email ? user.email.toLowerCase().trim() : null;
        const userPhone = user.phoneNumber || null;

        const hasSOWByEmail = userEmail && sowEmails.has(userEmail);
        const hasSOWByPhone = userPhone && sowPhones.has(userPhone);

        if (!hasSOWByEmail && !hasSOWByPhone) {
            console.log(`✓ ${user.email || user.phoneNumber} - NO SOW (should appear in dropdown)`);
            count++;
        } else {
            console.log(`✗ ${user.email || user.phoneNumber} - HAS SOW (hidden from dropdown)`);
        }
    });

    console.log(`\nTotal users without SOW: ${count}`);

    process.exit(0);
}

debug();

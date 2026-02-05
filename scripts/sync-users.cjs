/**
 * Sync Firebase Auth Users to Firestore
 *
 * This script fetches all users from Firebase Auth and adds them to the
 * Firestore 'users' collection.
 *
 * SETUP:
 * 1. Go to Firebase Console → Project Settings → Service Accounts
 * 2. Click "Generate new private key"
 * 3. Save the JSON file as "serviceAccountKey.json" in this folder
 * 4. Run: node sync-users.js
 */

const admin = require('firebase-admin');

// Check if service account key exists
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error('\n❌ ERROR: serviceAccountKey.json not found!\n');
    console.log('To fix this:');
    console.log('1. Go to Firebase Console: https://console.firebase.google.com/project/csites-b6d37/settings/serviceaccounts/adminsdk');
    console.log('2. Click "Generate new private key"');
    console.log('3. Save the downloaded file as "serviceAccountKey.json" in this folder');
    console.log('4. Run this script again: node sync-users.js\n');
    process.exit(1);
}

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Developer email to exclude from sync
const DEVELOPER_EMAIL = 'vistafly.services@gmail.com';

async function syncUsers() {
    console.log('\n🔄 Starting user sync...\n');

    try {
        // List all users from Firebase Auth
        const listUsersResult = await admin.auth().listUsers(1000);
        const users = listUsersResult.users;

        console.log(`Found ${users.length} users in Firebase Auth\n`);

        let added = 0;
        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const user of users) {
            // Skip developer email
            if (user.email && user.email.toLowerCase() === DEVELOPER_EMAIL.toLowerCase()) {
                console.log(`⊘ Skipped (developer): ${user.email}`);
                skipped++;
                continue;
            }

            const userData = {
                uid: user.uid,
                email: user.email || null,
                phoneNumber: user.phoneNumber || null,
                displayName: user.displayName || null,
                lastLogin: admin.firestore.FieldValue.serverTimestamp(),
                syncedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            try {
                // Check if user already exists
                const existingDoc = await db.collection('users').doc(user.uid).get();

                await db.collection('users').doc(user.uid).set(userData, { merge: true });

                if (existingDoc.exists) {
                    console.log(`✓ Updated: ${user.email || user.phoneNumber || user.uid}`);
                    updated++;
                } else {
                    console.log(`+ Added: ${user.email || user.phoneNumber || user.uid}`);
                    added++;
                }
            } catch (error) {
                console.error(`✗ Error with ${user.uid}: ${error.message}`);
                errors++;
            }
        }

        console.log('\n========================================');
        console.log(`✅ Sync complete!`);
        console.log(`   Added: ${added}`);
        console.log(`   Updated: ${updated}`);
        console.log(`   Skipped: ${skipped}`);
        console.log(`   Errors: ${errors}`);
        console.log('========================================\n');

    } catch (error) {
        console.error('❌ Error listing users:', error.message);
    }

    process.exit(0);
}

syncUsers();

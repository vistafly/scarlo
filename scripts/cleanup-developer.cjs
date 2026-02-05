/**
 * Remove developer from users collection
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanup() {
    console.log('\nRemoving developer from users collection...\n');

    const usersSnapshot = await db.collection('users').get();

    for (const doc of usersSnapshot.docs) {
        const user = doc.data();
        if (user.email && user.email.toLowerCase() === 'vistafly.services@gmail.com') {
            await db.collection('users').doc(doc.id).delete();
            console.log('✓ Deleted: vistafly.services@gmail.com');
        }
    }

    console.log('\nDone!\n');
    process.exit(0);
}

cleanup();

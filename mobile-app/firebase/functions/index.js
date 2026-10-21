// SafeDrive Cloud Functions (file 02 §9, task step 9).
//
// When the phone writes users/{uid}/accidents/{id} with status "dispatched",
// this function fans the alert out server-side, so no secret ever lives in the
// app:
//   1. FCM push to every emergency contact that has the app (fcmToken)
//   2. SMS gateway (robust channel) — Telegram / Twilio, credentials stored as
//      Firebase secrets: `firebase functions:secrets:set TELEGRAM_BOT_TOKEN`
//
// Deploy:  cd firebase && firebase deploy --only functions,firestore:rules

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");

function mapsLink(loc) {
  if (!loc) return "Unavailable";
  return `https://maps.google.com/?q=${loc.latitude.toFixed(6)},${loc.longitude.toFixed(6)}`;
}

function messageText(acc, driverName) {
  return [
    "SafeDrive Emergency Alert",
    `A possible severe vehicle accident has been detected${driverName ? ` for ${driverName}` : ""}.`,
    `Severity: ${(acc.severity || "HIGH").toUpperCase()}`,
    `Last known speed: ${Math.round(acc.speedAfter || 0)} km/h`,
    `Location: ${mapsLink(acc.location)}`,
    "Please contact the driver immediately.",
  ].join("\n");
}

exports.sendEmergencyAlert = onDocumentCreated(
  { document: "users/{uid}/accidents/{accidentId}", secrets: [TELEGRAM_BOT_TOKEN], region: "europe-west1" },
  async (event) => {
    const acc = event.data?.data();
    if (!acc || acc.status !== "dispatched") return;

    const db = getFirestore();
    const uid = event.params.uid;
    const user = (await db.doc(`users/${uid}`).get()).data() || {};
    const contactsSnap = await db.collection(`users/${uid}/emergencyContacts`).orderBy("priority").get();
    const contacts = contactsSnap.docs.map((d) => d.data());
    const text = messageText(acc, user.name);
    const results = [];

    // 1) FCM push — the notification opens the map link on the contact's phone.
    const tokens = contacts.map((c) => c.fcmToken).filter(Boolean);
    if (tokens.length) {
      const r = await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title: "🚨 SafeDrive emergency", body: `${user.name || "Your contact"} may have had a severe accident.` },
        data: { type: "emergency", mapsUrl: mapsLink(acc.location), accidentId: event.params.accidentId, uid },
        android: { priority: "high", notification: { channelId: "emergency", sound: "default" } },
        apns: { payload: { aps: { sound: "default", "interruption-level": "critical" } } },
      });
      results.push(`fcm:${r.successCount}/${tokens.length}`);
    }

    // 2) Gateway — Telegram chats subscribed to the bot (free in Egypt).
    const chatIds = (user.telegramChatIds || []).map(String);
    for (const chatId of chatIds) {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN.value()}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: `🚨 ${text}` }),
      });
      results.push(`telegram:${chatId}:${res.status}`);
      if (acc.location) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN.value()}/sendLocation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, latitude: acc.location.latitude, longitude: acc.location.longitude }),
        });
      }
    }

    await event.data.ref.update({ dispatchLog: results, dispatchedAt: new Date() });
  }
);

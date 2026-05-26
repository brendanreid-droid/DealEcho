import { onRequest } from "firebase-functions/v2/https";
import { db, admin } from "../lib/firebaseAdmin";

/**
 * HTTP endpoint serving as a 1x1 transparent tracking pixel.
 * Automatically tracks and increments unique opens for sent campaigns in Firestore.
 */
export const trackNewsletterOpen = onRequest({ cors: true }, async (req, res) => {
  const { newsletterId, uid } = req.query as { newsletterId: string; uid: string };

  if (newsletterId && uid) {
    try {
      const openRef = db
        .collection("newsletters")
        .doc(newsletterId)
        .collection("opens")
        .doc(uid);
      
      const docSnap = await openRef.get();

      // Only increment and log if this user hasn't opened this specific newsletter yet
      if (!docSnap.exists) {
        await openRef.set({
          openedAt: new Date().toISOString(),
        });

        await db
          .collection("newsletters")
          .doc(newsletterId)
          .update({
            opens: admin.firestore.FieldValue.increment(1),
          });
        
        console.log(`📊 Open registered for newsletter ${newsletterId} by user ${uid}`);
      }
    } catch (err) {
      console.error(`❌ Failed to track newsletter open for ${newsletterId}, user ${uid}:`, err);
    }
  }

  // 1x1 Transparent GIF pixel buffer representation
  const trackingPixelBuffer = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );

  // Serve pixel back directly with cache-busting headers
  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": trackingPixelBuffer.length,
    "Cache-Control": "no-cache, no-store, must-revalidate, private",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  res.end(trackingPixelBuffer);
});

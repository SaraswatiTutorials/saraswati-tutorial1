// Tutor document links: PDFs in our Cloudinary account get a signed download link,
// everything else is opened as stored.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseCloudinaryPdf, getDocumentOpenUrl } from "../utils/documentLink.js";

const CLOUD = "democloud";

describe("parseCloudinaryPdf", () => {
  test("reads resource type and public id from a versioned PDF link", () => {
    assert.deepEqual(
      parseCloudinaryPdf(`https://res.cloudinary.com/${CLOUD}/image/upload/v1712345678/saraswati-tutors/abc123.pdf`, CLOUD),
      { resourceType: "image", publicId: "saraswati-tutors/abc123" }
    );
  });

  test("skips transformation segments before the version", () => {
    assert.deepEqual(
      parseCloudinaryPdf(`https://res.cloudinary.com/${CLOUD}/image/upload/fl_attachment/v1/saraswati-tutors/x.pdf`, CLOUD),
      { resourceType: "image", publicId: "saraswati-tutors/x" }
    );
  });

  test("ignores images, other clouds and other hosts", () => {
    assert.equal(parseCloudinaryPdf(`https://res.cloudinary.com/${CLOUD}/image/upload/v1/saraswati-tutors/a.jpg`, CLOUD), null);
    assert.equal(parseCloudinaryPdf("https://res.cloudinary.com/othercloud/image/upload/v1/a.pdf", CLOUD), null);
    assert.equal(parseCloudinaryPdf("https://example.com/a.pdf", CLOUD), null);
    assert.equal(parseCloudinaryPdf("", CLOUD), null);
  });
});

describe("getDocumentOpenUrl", () => {
  test("returns image links unchanged", () => {
    process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
    const url = `https://res.cloudinary.com/${CLOUD}/image/upload/v1/saraswati-tutors/a.jpg`;
    assert.equal(getDocumentOpenUrl(url), url);
  });

  test("returns a signed, expiring download link for PDFs", () => {
    process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
    const link = getDocumentOpenUrl(`https://res.cloudinary.com/${CLOUD}/image/upload/v1/saraswati-tutors/a.pdf`);
    assert.match(link, new RegExp(`^https://api\\.cloudinary\\.com/v1_1/${CLOUD}/image/download\\?`));
    assert.match(link, /signature=/);
    assert.match(link, /expires_at=\d+/);
    assert.match(link, /public_id=saraswati-tutors%2Fa/);
  });
});

// Vercel Serverless Function for uploading logos
import { Octokit } from '@octokit/rest';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse form data
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB max
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const uploadedFile = files.logo?.[0];
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(uploadedFile.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only images allowed.' });
    }

    // Read file content
    const fileContent = fs.readFileSync(uploadedFile.filepath);
    const base64Content = fileContent.toString('base64');

    // GitHub setup
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    const owner = process.env.GITHUB_OWNER || 'opknice';
    const repo = process.env.GITHUB_REPO || 'React_Scoreboard';
    const fileName = uploadedFile.originalFilename || 'uploaded-logo.png';
    const filePath = `public/logos/${fileName}`;

    // Check if file exists
    let sha;
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
      });
      sha = data.sha; // File exists, we'll update it
    } catch (error) {
      // File doesn't exist, that's ok
    }

    // Create or update file
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Upload logo: ${fileName}`,
      content: base64Content,
      sha,
      branch: 'main',
    });

    // Clean up temp file
    fs.unlinkSync(uploadedFile.filepath);

    return res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      fileName,
      url: `/logos/${fileName}`,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      error: 'Upload failed',
      details: error.message,
    });
  }
}

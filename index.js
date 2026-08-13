const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const cors = require('cors');  // Import CORS
const app = express();

// Enable CORS for all requests
app.use(cors());  // This will allow access from anywhere

// Middleware to parse JSON request body
app.use(express.json());

let storedData = []; // Global variable to store the data

// Utility function to add a delay (sleep)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Function to fetch video download links and thumbnails
const fetchVideoData = async () => {
    try {
        const login = '0287aca2ef38b0d9a210'; // Your Streamtape login
        const key = 'k2ljGZWXMKirrK';         // Your Streamtape API key

        // First API: Get the list of all video IDs and names
        const videoListResponse = await axios.get(`https://api.streamtape.com/file/listfolder?login=${login}&key=${key}`);

        if (videoListResponse.data.status === 200) {
            const files = videoListResponse.data.result.files;  // Get all files (video IDs and names)
            console.log("Files found:", files);

            const videoLinks = [];

            // Loop through each file to get the download ticket, download link, and thumbnail
            for (const file of files) {
                const fileId = file.linkid;
                const fileName = file.name;

                try {
                    // Get download ticket for each file
                    const ticketResponse = await axios.get(`https://api.streamtape.com/file/dlticket?file=${fileId}&login=${login}&key=${key}`);

                    if (ticketResponse.data.status === 200) {
                        const ticket = ticketResponse.data.result.ticket;
                        console.log(`Download Ticket for ${fileName}:`, ticket);

                        // Wait for 4 seconds to avoid rate-limiting issues
                        await delay(4000);

                        // Use the download ticket to get the download link
                        const linkResponse = await axios.get(`https://api.streamtape.com/file/dl?file=${fileId}&ticket=${ticket}`);

                        if (linkResponse.data.status === 200) {
                            const downloadLink = linkResponse.data.result.url;
                            console.log(`Download Link for ${fileName}:`, downloadLink);

                            // Fourth API: Get video thumbnail (thumbs)
                            const thumbResponse = await axios.get(`https://api.streamtape.com/file/getsplash?login=${login}&key=${key}&file=${fileId}`);
                            const videoThumb = thumbResponse.data.result;
                            console.log(`Video Thumbs for ${fileName}:`, videoThumb);

                            // Add the video name, download link, and thumbnail to the array
                            videoLinks.push({
                                fileName: fileName,
                                downloadLink: downloadLink,
                                videoThumb: videoThumb
                            });
                        } else {
                            console.error(`Failed to get download link for ${fileName}:`, linkResponse.data.msg);
                            videoLinks.push({
                                fileName: fileName,
                                downloadLink: 'Error: Could not get download link',
                                videoThumb: 'Error: No thumbnail available'
                            });
                        }
                    } else {
                        console.error(`Failed to get download ticket for ${fileName}:`, ticketResponse.data.msg);
                        videoLinks.push({
                            fileName: fileName,
                            downloadLink: 'Error: Could not get download ticket',
                            videoThumb: 'Error: No thumbnail available'
                        });
                    }
                } catch (error) {
                    console.error(`Error processing file ${fileName}:`, error.message);
                    videoLinks.push({
                        fileName: fileName,
                        downloadLink: 'Error: Internal error while processing this file',
                        videoThumb: 'Error: No thumbnail available'
                    });
                }
            }

            // Store the result in memory
            storedData = videoLinks;
            console.log("Data fetched and stored successfully!");

        } else {
            console.error('Failed to get video list:', videoListResponse.data.msg);
        }
    } catch (error) {
        console.error('Error fetching video data:', error.message);
    }
};

// Schedule the task to run every 2 hours
cron.schedule('0 */2 * * *', () => {
    console.log('Fetching video data...');
    fetchVideoData(); // Fetch the data every 2 hours
});

// Route to get the stored download links and thumbnails via Streamtape APIs
app.get('/get-all-download-links', (req, res) => {
    if (storedData.length > 0) {
        // Send the stored data
        res.json({ videos: storedData });
    } else {
        // If no data is stored yet, send a message indicating that the data is being fetched
        res.status(500).json({ error: 'Data is not available yet. Please try again later.' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Fetch data once when the server starts
    fetchVideoData();
});

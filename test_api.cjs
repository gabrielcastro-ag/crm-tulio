const http = require('https');

const options = {
    method: 'POST',
    hostname: 'whatsapp-profile-data1.p.rapidapi.com',
    port: null,
    path: '/WhatsappProfilePhotoWithToken',
    headers: {
        'x-rapidapi-key': 'b9461961d9msh688b758d94c5f90p162d7ejsn405c20f723cc',
        'x-rapidapi-host': 'whatsapp-profile-data1.p.rapidapi.com',
        'Content-Type': 'application/json'
    }
};

const runTest = (phone, label) => {
    console.log(`Testing ${label}: ${phone}`);
    const req = http.request(options, function (res) {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => console.log(`Response ${label}:`, Buffer.concat(chunks).toString()));
    });
    req.write(JSON.stringify({ phone_number: phone }));
    req.end();
};

// 1. With 9 (User Message)
runTest('5538998859375', 'WITH 9');

// 2. Without 9 (Snippet) - Wait 2s
setTimeout(() => {
    runTest('553898859375', 'WITHOUT 9');
}, 2000);

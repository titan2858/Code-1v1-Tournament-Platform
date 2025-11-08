const User = require("../models/User");
const Room = require("../models/Room");
const dotenv = require('dotenv');

dotenv.config();

// Function to execute code using the compiler API
async function executeCode(script, language, stdin) {
    const execution_data = {
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        script: script,
        language: language,
        stdin: stdin,
        versionIndex: "0"
    };

    try {
        console.log('Executing code with JDoodle...');
        console.log('Language:', language);
        console.log('Has CLIENT_ID:', !!process.env.CLIENT_ID);
        console.log('Has CLIENT_SECRET:', !!process.env.CLIENT_SECRET);
        
        const response = await fetch("https://api.jdoodle.com/v1/execute", {
            method: 'POST',
            body: JSON.stringify(execution_data),
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`JDoodle API returned status ${response.status}`);
        }

        const data = await response.json();
        
        // Log the full response for debugging
        console.log('JDoodle Response:', JSON.stringify(data));
        
        // Check for various error conditions
        if (data.error) {
            console.error('JDoodle API Error:', data.error);
            throw new Error(`JDoodle Error: ${data.error}`);
        }
        
        if (data.statusCode && data.statusCode !== 200) {
            console.error('JDoodle Status Code Error:', data.statusCode, data.message);
            throw new Error(`JDoodle Error: ${data.message || 'Unknown error'}`);
        }

        // Check if output exists - handle both null and undefined
        if (data.output === null || data.output === undefined) {
            console.error('No output field in JDoodle response:', data);
            
            // If there's a compile error or runtime error, return it
            if (data.memory || data.cpuTime) {
                // Execution completed but no output
                return '';
            }
            
            throw new Error('No output returned from JDoodle');
        }
        
        // Clean and normalize output
        let output = String(data.output);
        
        // Remove JDoodle metadata lines
        const lines = output.split('\n');
        const cleanLines = lines.filter(line => {
            const trimmed = line.trim().toLowerCase();
            return trimmed.length > 0 &&
                   !trimmed.includes('warning:') &&
                   !trimmed.includes('note:') &&
                   !trimmed.includes('jdoodle');
        });
        
        output = cleanLines.join('\n').trim();
        
        // Normalize line endings
        output = output.replace(/\r\n/g, '\n');
        
        return output;
        
    } catch (error) {
        console.error('Execution Error Details:', {
            message: error.message,
            stack: error.stack,
            language: language
        });
        throw new Error(`Code execution failed: ${error.message}`);
    }
}

exports.getProblemID = async (req, res) => {
    try {
        const { userID } = req.query;
        const user = await User.findOne({ userID });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const problemID = user.problemID;
        res.status(200).json({ problemID });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.submitCode = async (req, res) => {
    try {
        const { script, language, userID, problemID } = req.body;
        
        console.log('=== Code Submission Started ===');
        console.log('UserID:', userID);
        console.log('ProblemID:', problemID);
        console.log('Language:', language);
        console.log('Script length:', script?.length);
        
        // Validate inputs
        if (!script || !language || !userID || !problemID) {
            return res.status(400).json({ 
                message: 'Missing required fields',
                missing: {
                    script: !script,
                    language: !language,
                    userID: !userID,
                    problemID: !problemID
                }
            });
        }
        
        let passedTestcases = 0;
        let totalTestcases = 0;
        let failedTests = [];
        let executionErrors = [];
        
        // Fetch test case headers
        console.log('Fetching test case headers...');
        const headerResponse = await fetch(`https://judgedat.u-aizu.ac.jp/testcases/${problemID}/header`);
        
        if (!headerResponse.ok) {
            throw new Error(`Failed to fetch test cases: ${headerResponse.status}`);
        }
        
        const headerData = await headerResponse.json();
        const headers = headerData.headers;
        
        console.log(`Found ${headers.length} test cases`);
        
        // Iterate over test case headers
        for (const header of headers) {
            const serial = header.serial;
            totalTestcases++;
            
            try {
                console.log(`\n--- Test Case ${serial} ---`);
                
                // Fetch test case data
                const testCaseResponse = await fetch(`https://judgedat.u-aizu.ac.jp/testcases/${problemID}/${serial}`);
                const testCaseData = await testCaseResponse.json();
                
                // Normalize input and expected output
                const input = testCaseData.in.trim().replace(/\r\n/g, '\n');
                const expectedOutput = testCaseData.out.trim().replace(/\r\n/g, '\n');
                
                console.log('Input length:', input.length);
                console.log('Expected output length:', expectedOutput.length);
                
                // Execute the code with current test case input
                const actualOutput = await executeCode(script, language, input);
                
                console.log('Actual output length:', actualOutput.length);
                
                // Normalize actual output for comparison
                const normalizedActual = actualOutput.trim().replace(/\r\n/g, '\n');
                const normalizedExpected = expectedOutput.trim().replace(/\r\n/g, '\n');
                
                // Compare actual output with expected output
                if (normalizedActual === normalizedExpected) {
                    passedTestcases++;
                    console.log(`✓ Test case ${serial}: PASSED`);
                } else {
                    console.log(`✗ Test case ${serial}: FAILED`);
                    console.log(`Expected: "${normalizedExpected.substring(0, 100)}"`);
                    console.log(`Actual: "${normalizedActual.substring(0, 100)}"`);
                    
                    // Store failed test info (limit to first 3)
                    if (failedTests.length < 3) {
                        failedTests.push({
                            serial,
                            input: input.substring(0, 100),
                            expected: normalizedExpected.substring(0, 100),
                            actual: normalizedActual.substring(0, 100)
                        });
                    }
                }
            } catch (error) {
                console.error(`✗ Error executing test case ${serial}:`, error.message);
                
                // Store execution error
                executionErrors.push({
                    serial,
                    error: error.message
                });
                
                // If it's a JDoodle API error, stop testing
                if (error.message.includes('JDoodle')) {
                    console.error('JDoodle API error - stopping test execution');
                    break;
                }
            }
        }
        
        console.log('\n=== Test Results ===');
        console.log(`Passed: ${passedTestcases}/${totalTestcases}`);
        
        // Update user's submission data
        const user = await User.findOne({ _id: userID });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        user.numberOfTestsPassed = passedTestcases;
        user.submissionTime = new Date();
        await user.save();
        
        console.log('User submission data updated');
        console.log('=== Code Submission Completed ===\n');

        // Return results with debug info
        const response = { 
            passedTestcases, 
            totalTestcases
        };
        
        // Only include debug info if there are failures or errors
        if (failedTests.length > 0) {
            response.failedTests = failedTests;
        }
        if (executionErrors.length > 0) {
            response.executionErrors = executionErrors;
        }
        
        res.status(200).json(response);
        
    } catch (error) {
        console.error('=== Submit Code Error ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        res.status(500).json({ 
            message: 'Server error during code submission',
            error: error.message,
            details: 'Check server logs for more information'
        });
    }
};

async function findResult(array) {
    let players = [];

    for (let i = 0; i < array.length; i += 2) {
        const ID1 = array[i].id;
        const user1 = await User.findOne({ _id: ID1 });
        const t1 = user1.numberOfTestsPassed;
        const s1 = user1.submissionTime;

        if (i === array.length - 1) {
            // Single player case (odd number of players)
            if (t1 > 0) {
                players.push(array[i]);
            }
        } else {
            const ID2 = array[i + 1].id;
            const user2 = await User.findOne({ _id: ID2 });
            const t2 = user2.numberOfTestsPassed;
            const s2 = user2.submissionTime;
            
            // Determine winner between two players
            if (s1 === null && s2 !== null) {
                players.push(array[i + 1]);
            } else if (s1 !== null && s2 === null) {
                players.push(array[i]);
            } else if (s1 === null && s2 === null) {
                players.push(array[i]);
            } else {
                if (t1 > t2) {
                    players.push(array[i]);
                } else if (t1 < t2) {
                    players.push(array[i + 1]);
                } else {
                    if (s1 < s2) {
                        players.push(array[i]);
                    } else {
                        players.push(array[i + 1]);
                    }
                }
            }
        }
    }
    return players;
}

exports.testJDoodle = async (req, res) => {
    try {
        console.log('=== JDoodle Test Endpoint ===');
        console.log('CLIENT_ID exists:', !!process.env.CLIENT_ID);
        console.log('CLIENT_SECRET exists:', !!process.env.CLIENT_SECRET);
        console.log('CLIENT_ID value:', process.env.CLIENT_ID?.substring(0, 10) + '...');
        
        const testPayload = {
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            script: "print('Hello World')",
            language: "python3",
            stdin: "",
            versionIndex: "0"
        };
        
        console.log('Sending test request to JDoodle...');
        
        const response = await fetch("https://api.jdoodle.com/v1/execute", {
            method: 'POST',
            body: JSON.stringify(testPayload),
            headers: { 'Content-Type': 'application/json' },
        });
        
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('JDoodle Response:', JSON.stringify(data, null, 2));
        
        res.json({
            success: !data.error,
            status: response.status,
            data: data,
            credentials: {
                hasClientId: !!process.env.CLIENT_ID,
                hasClientSecret: !!process.env.CLIENT_SECRET
            }
        });
    } catch (error) {
        console.error('Test endpoint error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
};

exports.calculateResult = async (req, res) => {
    try {
        const { roomId } = req.body;
        const room = await Room.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }
        
        const check = room.resultCalculated;
        if (check) {
            res.status(200).json({ message: 'Results already calculated' });
        } else {
            const players = room.players;
            room.oldPlayers = players;
            const newPlayers = await findResult(players);
            room.players = newPlayers;
            room.resultCalculated = true;
            room.roundStarted = false;
            
            await room.save();
    
            res.status(200).json({ 
                message: 'Results calculated successfully',
                winners: newPlayers
            });
        }
    } catch (error) {
        console.error('Calculate Result Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
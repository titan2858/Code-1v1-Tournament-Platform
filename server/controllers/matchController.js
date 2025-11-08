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
        const response = await fetch("https://api.jdoodle.com/v1/execute", {
            method: 'POST',
            body: JSON.stringify(execution_data),
            headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json();
        
        // Log the full response for debugging
        console.log('JDoodle Response:', JSON.stringify(data));
        
        // Check if there was an error in execution
        if (data.error) {
            console.error('JDoodle Error:', data.error);
            throw new Error(data.error);
        }
        
        // Check if output exists
        if (!data.output && data.output !== "") {
            console.error('No output field in response:', data);
            throw new Error('No output returned from JDoodle');
        }
        
        // Better output cleaning
        let output = data.output;
        
        // Remove any compilation warnings or messages (they usually start with specific patterns)
        // Split by newlines and filter out common compiler messages
        const lines = output.split('\n');
        const cleanLines = lines.filter(line => {
            // Keep lines that don't look like compiler warnings/messages
            return !line.includes('warning:') && 
                   !line.includes('Warning:') &&
                   !line.includes('note:') &&
                   !line.includes('JDoodle') &&
                   line.trim().length > 0;
        });
        
        output = cleanLines.join('\n').trim();
        
        // Normalize line endings (Windows vs Unix)
        output = output.replace(/\r\n/g, '\n');
        
        // Remove any trailing/leading whitespace
        output = output.trim();
        
        return output;
    } catch (error) {
        console.error('Execution Error:', error);
        throw new Error('Execution failed: ' + error.message);
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
        
        let passedTestcases = 0;
        let totalTestcases = 0;
        let failedTests = []; // Track failed tests for debugging
        
        // Fetch test case headers
        const headerResponse = await fetch(`https://judgedat.u-aizu.ac.jp/testcases/${problemID}/header`);
        const headerData = await headerResponse.json();
        const headers = headerData.headers;
        
        // Iterate over test case headers
        for (const header of headers) {
            const serial = header.serial;
            totalTestcases++;
            
            try {
                // Fetch test case data
                const testCaseResponse = await fetch(`https://judgedat.u-aizu.ac.jp/testcases/${problemID}/${serial}`);
                const testCaseData = await testCaseResponse.json();
                
                // Normalize input and expected output
                const input = testCaseData.in.trim().replace(/\r\n/g, '\n');
                const expectedOutput = testCaseData.out.trim().replace(/\r\n/g, '\n');
                
                // Execute the code with current test case input
                const actualOutput = await executeCode(script, language, input);
                
                // Normalize actual output for comparison
                const normalizedActual = actualOutput.trim().replace(/\r\n/g, '\n');
                const normalizedExpected = expectedOutput.trim().replace(/\r\n/g, '\n');
                
                // Compare actual output with expected output
                if (normalizedActual === normalizedExpected) {
                    passedTestcases++;
                    console.log(`Test case ${serial}: PASSED`);
                } else {
                    console.log(`Test case ${serial}: FAILED`);
                    console.log(`Input: ${input}`);
                    console.log(`Expected: "${normalizedExpected}"`);
                    console.log(`Actual: "${normalizedActual}"`);
                    
                    // Store failed test info (limit to first 3 for performance)
                    if (failedTests.length < 3) {
                        failedTests.push({
                            serial,
                            input: input.substring(0, 100), // Limit length
                            expected: normalizedExpected.substring(0, 100),
                            actual: normalizedActual.substring(0, 100)
                        });
                    }
                }
            } catch (error) {
                console.error(`Error executing test case ${serial}:`, error);
                // Mark test case as failed if there's an execution error
                failedTests.push({
                    serial,
                    error: error.message
                });
            }
        }
        
        // Update user's submission data
        const user = await User.findOne({ _id: userID });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        user.numberOfTestsPassed = passedTestcases;
        user.submissionTime = new Date();
        
        await user.save();

        // Return results with debug info
        res.status(200).json({ 
            passedTestcases, 
            totalTestcases,
            failedTests: failedTests.length > 0 ? failedTests : undefined // Only include if there are failures
        });
    } catch (error) {
        console.error('Submit Code Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
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
                // Player 2 submitted, Player 1 didn't
                players.push(array[i + 1]);
            } else if (s1 !== null && s2 === null) {
                // Player 1 submitted, Player 2 didn't
                players.push(array[i]);
            } else if (s1 === null && s2 === null) {
                // Neither submitted - default to first player
                players.push(array[i]);
            } else {
                // Both submitted - compare scores
                if (t1 > t2) {
                    players.push(array[i]);
                } else if (t1 < t2) {
                    players.push(array[i + 1]);
                } else {
                    // Same score - earlier submission wins
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
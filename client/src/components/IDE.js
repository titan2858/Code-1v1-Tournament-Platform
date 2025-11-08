import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from "axios";

// Map JDoodle language IDs to Monaco Editor language IDs
const getMonacoLanguage = (jdoodleLanguage) => {
  const mapping = {
    'c': 'c',
    'cpp14': 'cpp',
    'java': 'java',
    'python3': 'python',
    'nodejs': 'javascript'
  };
  return mapping[jdoodleLanguage] || 'plaintext';
};

const IDE = ({ userID, problemID }) => {
  const [language, setLanguage] = useState("cpp14"); // Default to C++
  const [code, setCode] = useState("#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code here\n    return 0;\n}");
  const editorRef = useRef(null);

  // Language configurations - JDoodle compatible
  const languages = [
    { id: "c", name: "C", defaultCode: "#include <stdio.h>\n\nint main() {\n    // Your code here\n    return 0;\n}" },
    { id: "cpp14", name: "C++", defaultCode: "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code here\n    return 0;\n}" },
    { id: "java", name: "Java", defaultCode: "public class Main {\n    public static void main(String[] args) {\n        // Your code here\n    }\n}" },
    { id: "python3", name: "Python", defaultCode: "# Write your code here\n" },
    { id: "nodejs", name: "JavaScript", defaultCode: "// Write your code here\nconsole.log('Hello World');\n" },
  ];

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  const handleLanguageChange = (e) => {
    const selectedLang = e.target.value;
    setLanguage(selectedLang);
    
    // Set default code for the selected language
    const langConfig = languages.find(lang => lang.id === selectedLang);
    if (langConfig) {
      setCode(langConfig.defaultCode);
    }
  };

  const submitCode = async () => {
    const script = editorRef.current.getValue();
    
    if (!script.trim()) {
      toast.error("Please write some code before submitting!");
      return;
    }

    try {
      toast.info("Submitting code...", { autoClose: 2000 });

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/tournament/match/submitCode`,
        {
          script,
          language, // This will send JDoodle-compatible language ID
          userID,
          problemID
        }
      );

      const { passedTestcases, totalTestcases } = response.data;

      let toastType = 'info';
      let verdict = "Wrong answer";

      if (passedTestcases === totalTestcases) {
        toastType = 'success';
        verdict = "Correct answer";
      } else if (passedTestcases === 0) {
        toastType = 'error';
      } else {
        toastType = 'warning';
      }

      toast[toastType](
        <div>
          <div>Test Cases Passed: {passedTestcases}/{totalTestcases}</div>
          <div>Verdict: {verdict}</div>
        </div>,
        { autoClose: 10000 }
      );

    } catch (error) {
      console.error('Error submitting code:', error);
      toast.error("Error submitting code. Please try again.");
    }
  };

  return (
    <div>
      <ToastContainer />
      <div
        style={{
          marginTop: "3rem",
          fontFamily: 'Arial, sans-serif',
          width: "90%",
          marginLeft: "auto",
          marginRight: "auto",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0px 0px 10px 0px rgba(0,0,0,0.1)"
        }}
      >
        <center style={{ fontSize: '40px', fontWeight: 'bold', color: '#fff', marginBottom: '20px' }}>
          Code Editor
        </center>

        {/* Language Selector */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            marginBottom: "1rem",
            marginTop: "2rem"
          }}
        >
          <h3 style={{ margin: "0 10px 0 0", color: "#fff" }}>Select Language:</h3>
          <select
            value={language}
            onChange={handleLanguageChange}
            style={{
              padding: "8px",
              fontSize: "16px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              boxShadow: "0px 2px 5px 0px rgba(0,0,0,0.1)",
              minWidth: "150px",
              cursor: "pointer"
            }}
          >
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Monaco Editor */}
        <div style={{ 
          border: "2px solid #ccc", 
          borderRadius: "8px", 
          overflow: "hidden",
          marginBottom: "2rem"
        }}>
          <Editor
            height="500px"
            language={getMonacoLanguage(language)} // Use Monaco-compatible language
            value={code}
            onChange={(value) => setCode(value)}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: "on"
            }}
          />
        </div>

        {/* Note */}
        <div
          style={{
            marginTop: "2rem",
            backgroundColor: "#2c3e50",
            color: "#fff",
            padding: "20px",
            borderRadius: "8px",
            maxWidth: "600px",
            margin: "0 auto 2rem auto"
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "10px" }}>Note:</div>
          <ul style={{ marginBottom: "10px", paddingLeft: "20px" }}>
            <li>Latest submission is taken into consideration while comparing.</li>
            <li style={{ marginTop: "10px" }}>You need to write something in the Code Editor before submitting, otherwise you won't get any results.</li>
          </ul>
        </div>

        {/* Submit Button */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            style={{
              marginTop: "1rem",
              marginBottom: "1.5rem",
              textDecoration: "none",
              color: "#fff",
              fontSize: "1.5rem",
              fontWeight: "bold",
              textShadow: "1px 1px 2px rgba(0, 0, 0, 0.6)",
              padding: "1rem 2rem",
              backgroundColor: "#16a085",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              boxShadow: "0 2px 5px rgba(0, 0, 0, 0.3)",
              transition: "background-color 0.3s ease, transform 0.2s ease",
              display: "inline-block"
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#1abc9c";
              e.target.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#16a085";
              e.target.style.transform = "scale(1)";
            }}
            onClick={submitCode}
          >
            Submit Code
          </button>
        </div>
      </div>
    </div>
  );
};

export default IDE;
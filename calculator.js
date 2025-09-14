
window.MathJax = {
    tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
    },
    svg: {
        fontCache: 'global',
    },
};

let currentInput = '';
let history = [];
let lastResult = '';
let lastWasEquals = false;
let chartInstance = null;

// Helper functions
function safeGetElement(id) {
    return document.getElementById(id);
}

// Global function for clearing history, accessible by onclick
function clearHistory() {
    const historyList = document.getElementById('history-list');
    if (historyList) {
        history = [];
        historyList.innerHTML = '';
        console.log("History cleared.");
    } else {
        console.warn("History list element not found.");
    }

}

window.addEventListener('DOMContentLoaded', () => {
    function prepareExpression(expr) {
        let expressionToEvaluate = expr;

        // Replace custom symbols with math.js friendly ones
        expressionToEvaluate = expressionToEvaluate
            .replace(/π/g, 'pi')   // Replace pi symbol with 'pi' string for math.js
            .replace(/√/g, 'sqrt') // Replace square root symbol with 'sqrt' function name
            .replace(/×/g, '*')    // Replace multiplication symbol
            .replace(/÷/g, '/')    // Replace division symbol
            .replace(/−/g, '-')    // Replace Unicode minus with standard hyphen-minus
            .replace(/%/g, 'mod') // Replace % for modulus with 'mod' for math.js
            .replace(/(\d+)P\((\d+)\)/g, 'permutations($1,$2)') // Replace nP(k) with permutations(n,k)
            .replace(/(\d+)C\((\d+)\)/g, 'combinations($1,$2)') // Replace nC(k) with combinations(n,k)
            .replace(/P\(/g, 'permutations(') // Replace P( with permutations(
            .replace(/nCr\(/g, 'combinations(') // Replace nCr( with combinations(
            .replace(/C\(/g, 'combinations('); // Replace C( with combinations(

        return expressionToEvaluate;
    }

    // --- CORE CALCULATOR ELEMENTS ---
    const screen = safeGetElement('calculator-screen');
    // Removed readOnly to allow blinking caret when focused
    // Prevent direct typing to avoid input doubling
    screen.addEventListener('input', (e) => {
        // Revert value to prevent direct input changes
        screen.value = currentInput;
    });
    const historyList = safeGetElement('history-list');
    const themeToggle = safeGetElement('theme-toggle');
    const voiceInputBtn = safeGetElement('voice-input');

    // New: Basic and Scientific calculator keys containers
    const basicToggle = safeGetElement('basic-toggle');
    const basicButtons = document.querySelector('.basic-keys');
    const scientificToggle = document.getElementById('scientific-toggle');
    const scientificButtons = document.querySelector('.scientific-buttons');
    const graphicalToggle = document.getElementById('graphical-toggle');
    const graphicalButtons = document.querySelector('.graphical-buttons');

    // Additional buttons for future features
    const matrixBtn = document.getElementById('matrixBtn');
    const equationBtn = document.getElementById('equationBtn');
    const baseBtn = document.getElementById('baseBtn');
    const statsBtn = document.getElementById('statsBtn');

    if (matrixBtn) {
        matrixBtn.addEventListener('click', () => {
            showModal('matrixModal');
        });
    }
    if (equationBtn) {
        equationBtn.addEventListener('click', () => {
            showModal('equationModal');
        });
    }
    if (baseBtn) {
        baseBtn.addEventListener('click', () => {
            showModal('baseModal');
        });
    }
    if (statsBtn) {
        statsBtn.addEventListener('click', () => {
            showModal('statsModal');
        });
    }

    // Update event listener for Calculate button in stats modal to call calculateAllStatistics
    const calculateStatsBtn = document.getElementById('calculateStats');
    if (calculateStatsBtn) {
        calculateStatsBtn.addEventListener('click', () => {
            calculateAllStatistics();
        });
    }

    // --- UTILITY FUNCTIONS ---
    function updateScreen(value) {
        if (screen) {
            screen.value = value;
        } else {
            console.error("Calculator screen element not found.");
        }
    }

    function addToHistory(expression, result) {
        if (historyList) {
            const entry = document.createElement('li');
            entry.textContent = `${expression} = ${result}`;
            historyList.prepend(entry);
            history.unshift({ expression, result });
            if (history.length > 10) history.pop(); // Keep history limited
        } else {
            console.warn("History list element not found for adding entry.");
        }
    }

    // Helper function for Gemini API
    async function callGeminiAPI(payload) {
        const apiKey = "AIzaSyAdHP06CFqp1GHZFEY2nIg8GxyU3i5B-uU";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return await response.json();
    }

    // --- GEMINI PROBLEM SOLVER ---
    async function solveWordProblem() {
        const problemInput = safeGetElement('problem-input');
        const resultDiv = safeGetElement('problem-result');
        const solveBtn = safeGetElement('solveProblemBtnModal');

        if (!problemInput || !resultDiv || !solveBtn) {
            console.error("Problem solver elements not found.");
            return;
        }

        const problemText = problemInput.value.trim();
        if (!problemText) {
            resultDiv.innerText = "Please enter a problem to solve.";
            return;
        }

        // Show loading state
        solveBtn.innerHTML = '<div class="spinner"></div>';
        solveBtn.disabled = true;
        resultDiv.innerText = "Solving problem...";

        const systemPrompt = "You are a world-class math problem solver. When given a word problem, your task is to identify the mathematical question, extract the relevant numbers, determine the correct operations, provide a step-by-step solution, and finally, present the final numerical answer. Your response should be structured clearly with a 'Problem Analysis', 'Step-by-step Solution', and 'Final Answer' section.";
        const userQuery = problemText;

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            tools: [{ "google_search": {} }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
        };

        try {
            const result = await callGeminiAPI(payload);
            const candidate = result.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                const text = candidate.content.parts[0].text;
                resultDiv.innerText = text;
                addToHistory(`Word Problem: ${problemText}`, 'Solved with AI');
            } else {
                resultDiv.innerText = "Error: Could not get a response from the AI.";
            }
        } catch (e) {
            resultDiv.innerText = `Error: ${e.message}`;
            console.error("Problem Solver Error:", e);
        }

        // Restore button state
        solveBtn.innerHTML = 'Solve Problem';
        solveBtn.disabled = false;
    }

    // Set up problem solver modal event listeners
    const solveProblemBtn = document.getElementById('solveProblemBtn');
    const closeSolveProblemModal = document.getElementById('closeSolveProblemModal');
    const solveProblemBtnModal = document.getElementById('solveProblemBtnModal');

    if (solveProblemBtn) {
        solveProblemBtn.onclick = () => showModal('solveProblemModal');
    } else {
        console.warn("Solve Problem button not found.");
    }

    if (closeSolveProblemModal) {
        closeSolveProblemModal.onclick = () => hideModal('solveProblemModal');
    } else {
        console.warn("Close Solve Problem Modal button not found.");
    }

    if (solveProblemBtnModal) {
        solveProblemBtnModal.onclick = solveWordProblem;
    } else {
        console.warn("Solve Problem Modal button not found.");
    }

    // --- MAIN CALCULATOR EXPRESSION EVALUATION ---
    function calculateExpression(expr) {
        try {
            let expressionToEvaluate = prepareExpression(expr);

            console.log("Expression sent to math.evaluate:", expressionToEvaluate);

            // Define scope for evaluation
            const scope = {
                PI: math.pi,
                sin: math.sin,
                cos: math.cos,
                tan: math.tan,
                log: math.log10,
                ln: math.log,
                exp: math.exp,
                permutations: math.permutations,
                combinations: math.combinations
            };

            // Evaluate the expression using math.js with degree-based trig functions
            const result = math.evaluate(expressionToEvaluate, scope);
            lastResult = result;

            // Format the result for display
            if (typeof result === 'number') {
                // Limit precision for numbers
                return parseFloat(result.toFixed(10));
            } else if (result && typeof result.toString === 'function') {
                // For math.js types like Unit, Matrix, Complex, etc.
                return result.toString();
            } else {
                // Return other types directly
                return result;
            }
        } catch (e) {
            console.error("Calculation failed for expression:", expr, "Error:", e);
            return 'Error';
        }
    }

    function clearAll() {
        currentInput = '';
        lastWasEquals = false;
        updateScreen('');
    }

    function backspace() {
        currentInput = currentInput.slice(0, -1);
        lastWasEquals = false;
        updateScreen(currentInput);
    }

    function toggleSign() {
        if (currentInput.startsWith('-')) {
            currentInput = currentInput.substring(1); // Remove leading minus
        } else if (currentInput !== '') { // Only add if not empty
            currentInput = '-' + currentInput;
        }
        lastWasEquals = false;
        updateScreen(currentInput);
    }


    function appendInput(val) {
        if (lastWasEquals && !isNaN(val)) {
            currentInput = val;
            lastWasEquals = false;
        } else {
            currentInput += val;
        }
        updateScreen(currentInput);
    }

    function handleFunction(action) {
        switch (action) {
            case 'clear':
                clearAll();
                break;
            case 'backspace':
                backspace();
                break;
            case 'toggle-sign':
                toggleSign();
                break;
            case 'decimal':
                if (!currentInput.includes('.')) appendInput('.');
                break;
            case 'equals':
                const result = calculateExpression(currentInput);
                if (result !== 'Error') {
                    addToHistory(currentInput, result);
                    currentInput = String(result);
                }
                updateScreen(result);
                lastWasEquals = true;
                break;
            case 'sqrt':
                appendInput('√('); // Appends the symbol, which calculateExpression will convert
                break;
            case 'pi':
                appendInput('π'); // Appends the symbol, which calculateExpression will convert
                break;
            case 'sin':
            case 'cos':
            case 'tan':
            case 'log':
            case 'ln':
            case 'exp':
                appendInput(`${action}(`); // Appends function name with opening parenthesis
                break;
            case 'pow':
                appendInput('^'); // Appends the symbol, which calculateExpression will convert
                break;
            case 'square':
                appendInput('^2');
                break;
            case 'npr':
                appendInput('P(');
                break;
            case 'ncr':
                appendInput('C(');
                break;
            case 'open-paren':
                appendInput('(');
                break;
            case 'close-paren':
                appendInput(')');
                break;
            case 'factorial':
                appendInput('!');
                break;
            case 'ans':
                if (lastResult) {
                    appendInput(lastResult);
                } else {
                    showCustomAlert('No previous result available.');
                }
                break;
        }
    }

    function handleClick(action, type) {
        if (type === 'number') {
            appendInput(action);
        } else if (type === 'operator') {
            // Ensure these are the correct Unicode characters from your buttons
            const ops = { add: '+', subtract: '−', multiply: '×', divide: '÷', modulus: '%' };
            appendInput(ops[action]);
        } else if (type === 'function') {
            handleFunction(action);
        }
    }

    // --- EVENT LISTENERS FOR MAIN CALCULATOR BUTTONS ---
    document.querySelectorAll('.calculator-keys .key').forEach((btn) => {
        const action = btn.getAttribute('data-action');
        if (!action) return;

        const type = btn.classList.contains('number')
            ? 'number'
            : btn.classList.contains('operator')
                ? 'operator'
                : 'function';

        btn.addEventListener('click', () => handleClick(action, type));
    });

    // --- KEYBOARD SUPPORT ---
    document.addEventListener('keydown', (e) => {
        // Only handle keyboard input if the calculator screen is focused
        if (document.activeElement !== screen) return;
        const key = e.key;
        if (!isNaN(key)) {
            appendInput(key);
        } else if (['+', '-', '*', '/', '.', '(', ')', '!'].includes(key)) { // Added '!' to direct input
            appendInput(key);
        } else if (key === '%') { // Handle modulus separately if needed, or let it pass as operator
            appendInput('%');
        }
        else if (key === 'Enter') {
            e.preventDefault(); // Prevent default Enter behavior (e.g., submitting a form)
            handleFunction('equals');
        } else if (key === 'Backspace') {
            backspace();
        } else if (key === 'Escape') {
            clearAll();
        }
    });

    // --- THEME TOGGLE ---
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light');
            themeToggle.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
        });
    } else {
        console.warn("Theme toggle button not found.");
    }

    // --- SIDEBAR TOGGLES ---
    // Variables already declared above

    if (scientificToggle && graphicalToggle && scientificButtons && basicToggle && basicButtons) {
        function toggleMode(mode) {
            // --- NEW CODE START ---
            // Get references to the new main view containers
            const calculatorView = document.getElementById('calculator-view');
            const graphicalView = document.getElementById('graphical-view');

            // First, hide all main views
            calculatorView.classList.remove('active');
            if (graphicalView) graphicalView.classList.remove('active');
            // --- NEW CODE END ---

            // Original code for hiding components (still needed)
            const scientificKeys = document.querySelector('.scientific-keys');
            const graphCanvas = document.getElementById('graph-canvas');
            const latexOutput = document.getElementById('latex-output');

            basicButtons.classList.add('hidden');
            scientificKeys.classList.add('hidden');
            if (scientificButtons) scientificButtons.classList.add('hidden');
            if (graphicalButtons) graphicalButtons.classList.add('hidden'); // This line is in your original code, but my new structure doesn't need it. It's safe to keep.
            // Remove hiding graphCanvas and latexOutput here to ensure they show in graphical mode
            // if (graphCanvas) graphCanvas.classList.add('hidden');
            // if (latexOutput) latexOutput.classList.add('hidden');

            if (mode !== 'graphical' && chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }

            // Remove active class from all nav buttons
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

            // Show the correct view and components
            if (mode === 'basic') {
                calculatorView.classList.add('active'); // Show calculator view
                basicButtons.classList.remove('hidden');
                document.getElementById('basic-toggle').classList.add('active');
            } else if (mode === 'scientific') {
                calculatorView.classList.add('active'); // Show calculator view
                basicButtons.classList.remove('hidden');
                scientificKeys.classList.remove('hidden');
                if (scientificButtons) scientificButtons.classList.remove('hidden');
                document.getElementById('scientific-toggle').classList.add('active');
            } else if (mode === 'graphical') {
                if (graphicalView) graphicalView.classList.add('active'); // Show graphical view
                if (graphCanvas) graphCanvas.classList.remove('hidden'); // This is already handled by the view, but let's keep for safety
                document.getElementById('graphical-toggle').classList.add('active');
            }
        }

        scientificToggle.addEventListener('click', () => toggleMode('scientific'));
        graphicalToggle.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                showCustomAlert('Use Graphical Calculator in desktop for better view and export.');
            }
            toggleMode('graphical');
        });
        basicToggle.addEventListener('click', () => toggleMode('basic'));

        // Default to basic mode
        toggleMode('basic');
    } else {
        console.warn("Sidebar toggle elements not found.");
    }


    // --- HISTORY PANEL TOGGLE ---
    // Removed history toggle button and panel event listener as history button is removed

    // --- VOICE INPUT ---
    if (voiceInputBtn) {
        voiceInputBtn.addEventListener('click', () => {
            if (!('webkitSpeechRecognition' in window)) {
                showCustomAlert('Voice recognition not supported in this browser. Please use Chrome or a compatible browser.');
                return;
            }
            const recognition = new webkitSpeechRecognition();
            recognition.lang = 'en-US';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            recognition.start();

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.toLowerCase();
                const spokenExpression = transcript
                    .replace(/plus/g, '+')
                    .replace(/minus/g, '-')
                    .replace(/times|into/g, '*')
                    .replace(/divided by|by/g, '/')
                    .replace(/modulus|mod/g, '%')
                    .replace(/pi/g, 'π')
                    .replace(/square root of/g, '√(')
                    .replace(/power/g, '^')
                    .replace(/factorial/g, '!'); // Added factorial voice command

                currentInput += spokenExpression;
                updateScreen(currentInput);
                lastWasEquals = false;
            };

            recognition.onerror = (e) => {
                showCustomAlert('Voice input error: ' + e.error);
            };
        });
    } else {
        console.warn("Voice input button not found.");
    }


    // --- GRAPHING FUNCTIONALITY ---
    const plotBtn = document.getElementById('plotBtn');
    const exportBtn = document.getElementById('exportBtn');
    const pdfBtn = document.getElementById('pdfBtn');
    const graphCanvas = document.getElementById('graph-canvas');
    const latexOutput = document.getElementById('latex-output');

    function generateFunctionTable(expr, xStart = -2 * Math.PI, xEnd = 2 * Math.PI, step = 0.1) { // Use radians, cover -2π to 2π
        const table = [];
        for (let x = xStart; x <= xEnd; x += step) {
            try {
                // Use standard Math functions with radians
                const scope = {
                    x: x,
                    PI: Math.PI,
                    sin: Math.sin,
                    cos: Math.cos,
                    tan: Math.tan,
                    log: Math.log10,
                    ln: Math.log,
                    exp: Math.exp
                };
                const y = math.evaluate(expr, scope);
                if (typeof y === 'number' && !isNaN(y) && Math.abs(y) < 1e10) {
                    table.push({ x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) });
                }
            } catch (e) {
                // Skip invalid points
            }
        }
        return table;
    }

    function plotAnyFunctionAndDerivative(expr) {
        const derivExpr = math.derivative(expr, 'x').toString();
        const parsedExpr = prepareExpression(expr);
        const parsedDeriv = prepareExpression(derivExpr);
        const fTable = generateFunctionTable(parsedExpr);
        const fPrimeTable = generateFunctionTable(parsedDeriv);
        plotGraph([
            { label: `f(x) = ${expr}`, color: '#00ffcc', data: fTable },
            { label: `f'(x) = ${derivExpr}`, color: '#ff6600', data: fPrimeTable }
        ], `${expr} and ${derivExpr}`);
    }

    function plotGraph(datasets, exprLatex) {
        if (!graphCanvas) {
            console.error("Graph canvas not found.");
            return;
        }
        const ctx = graphCanvas.getContext('2d');
        if (chartInstance) chartInstance.destroy();

        graphCanvas.classList.remove('hidden');
        // Set canvas background to black to match the image
        graphCanvas.style.backgroundColor = '#000000';
        if (latexOutput) latexOutput.classList.remove('hidden');
        if (latexOutput) latexOutput.style.backgroundColor = '#000000'; // Match background

        // Calculate min/max for dynamic Y-axis scaling across all datasets
        let allYValues = [];
        datasets.forEach(ds => {
            allYValues = allYValues.concat(ds.data.map(p => p.y).filter(y => typeof y === 'number' && !isNaN(y)));
        });
        let minY = allYValues.length > 0 ? Math.min(...allYValues) : -10;
        let maxY = allYValues.length > 0 ? Math.max(...allYValues) : 10;

        // Add padding to Y-axis
        const yPadding = (maxY - minY) * 0.1; // 10% padding
        minY -= yPadding;
        maxY += yPadding;

        // Ensure a default range if data is flat or empty
        if (minY === maxY) {
            minY -= 1;
            maxY += 1;
        }

        // Prepare datasets for Chart.js
        const chartDatasets = datasets.map(ds => ({
            label: ds.label,
            data: ds.data, // Use {x, y} objects
            borderColor: ds.color,
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            pointBackgroundColor: ds.color,
            pointBorderColor: '#ffffff',
            parsing: { xAxisKey: 'x', yAxisKey: 'y' } // Tell Chart.js to use x/y keys
        }));

        // Use the first dataset's x values for labels (assuming all have same x range)
        const labels = datasets[0].data.map(p => p.x);

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: chartDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: { display: true, text: 'x', color: '#ffffff' }, // White text for x-axis title
                        ticks: { color: '#ffffff' }, // White text for x-axis ticks
                        grid: { color: 'rgba(255,255,255,0.2)' } // Lighter grid for visibility on black
                    },
                    y: {
                        type: 'linear', // Ensure type is linear
                        position: 'left',
                        title: { display: true, text: 'y', color: '#ffffff' }, // White text for y-axis title
                        ticks: { color: '#ffffff' }, // White text for y-axis ticks
                        grid: { color: 'rgba(255,255,255,0.2)' }, // Lighter grid for visibility on black
                        min: minY, // Set dynamic min Y
                        max: maxY  // Set dynamic max Y
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff' // White text for legend
                        }
                    }
                },
                // Set chart area background to black
                layout: {
                    backgroundColor: '#000000'
                }
            }
        });

        if (latexOutput) {
            // Format exprLatex for LaTeX display
            let latexContent = '';
            if (datasets.length === 1) {
                latexContent = `f(x) = ${exprLatex}`;
                // Clear derivative output if any
                const derivativeOutput = document.getElementById('derivativeOutput');
                if (derivativeOutput) {
                    derivativeOutput.innerHTML = '';
                    derivativeOutput.classList.add('hidden');
                }
            } else {
                // For multiple datasets, assume first is function, second is derivative
                latexContent = `f(x) = ${exprLatex.split(' and ')[0]}`;
                const derivativeOutput = document.getElementById('derivativeOutput');
                if (derivativeOutput) {
                    derivativeOutput.innerHTML = `f'(x) = ${exprLatex.split(' and ')[1]}`;
                    derivativeOutput.classList.remove('hidden');
                }
            }
            latexOutput.innerHTML = latexContent;
            // Ensure latexOutput text color is white for visibility on black background
            latexOutput.style.color = '#ffffff';
            if (window.MathJax && MathJax.startup && MathJax.startup.promise) {
                MathJax.startup.promise.then(() => {
                    MathJax.typesetPromise([latexOutput]);
                    if (derivativeOutput) {
                        MathJax.typesetPromise([derivativeOutput]);
                    }
                }).catch(e => console.warn('MathJax typesetting failed:', e));
            }
        }
        // Remove history list content when plotting graph
        const historyList = document.getElementById('history-list');
        if (historyList) {
            historyList.innerHTML = '';
        }
    }

    if (plotBtn) {
        plotBtn.addEventListener('click', () => {
            showModal("plotModal");
        });
    } else {
        console.warn("Plot button not found.");
    }


    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (!graphCanvas || graphCanvas.classList.contains('hidden')) {
                showCustomAlert("No graph to export. Please plot a function first.");
                return;
            }
            // Ensure the chart is rendered before attempting to export
            setTimeout(() => {
                const link = document.createElement('a');
                link.download = 'graph.png';
                link.href = graphCanvas.toDataURL('image/png');
                link.click();
                addToHistory('Exported graph to PNG', '');
            }, 100); // Small delay to ensure render
        });
    } else {
        console.warn("Export PNG button not found.");
    }


    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            if (typeof window.jspdf === 'undefined') {
                alert('jsPDF library not loaded. Please ensure internet connectivity.');
                return;
            }
            if (!graphCanvas || graphCanvas.classList.contains('hidden')) {
                alert("No graph to export to PDF. Please plot a function first.");
                return;
            }
            // Ensure the chart is rendered before attempting to export
            setTimeout(() => {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();

                const imgData = graphCanvas.toDataURL('image/png');
                const imgWidth = doc.internal.pageSize.getWidth() - 20; // 10px margin on each side
                const imgHeight = (graphCanvas.height * imgWidth) / graphCanvas.width;
                let position = 10;

                doc.text("Advanced Calculator Plot", 10, position);
                position += 10;

                doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);

                doc.save('graph.pdf');
                addToHistory('Exported graph to PDF', '');
            }, 100); // Small delay to ensure render
        });
    } else {
        console.warn("Export PDF button not found.");
    }


    // --- MODAL UTILITIES ---
    function showModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove("hidden");
            console.log(`Modal '${id}' shown.`);
        } else {
            console.error(`Modal with ID '${id}' not found.`);
        }
    }

    function hideModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add("hidden");
            console.log(`Modal '${id}' hidden.`);
        } else {
            console.error(`Modal with ID '${id}' not found.`);
        }
    }

    // --- CUSTOM ALERT MODAL ---
    function showCustomAlert(message) {
        const modal = document.getElementById('customAlertModal');
        const messageDiv = document.getElementById('customAlertMessage');
        if (modal && messageDiv) {
            messageDiv.textContent = message;
            modal.classList.remove("hidden");
        } else {
            console.error("Custom alert modal or message div not found.");
        }
    }

    const closeCustomAlertBtn = document.getElementById("closeCustomAlertModal");
    if (closeCustomAlertBtn) {
        closeCustomAlertBtn.onclick = () => hideModal("customAlertModal");
    } else {
        console.warn("Close Custom Alert Modal button not found.");
    }




    // --- DERIVATIVE TOOL ---
    const derivativeBtn = document.getElementById("plotDerivativeBtn");

    if (derivativeBtn) {
        derivativeBtn.addEventListener('click', () => {
            if (typeof math === 'undefined') {
                alert("Error: math.js library not loaded.");
                return;
            }
            // Show plot modal and clear input
            const plotModal = document.getElementById('plotModal');
            const functionInput = document.getElementById('functionInput');
            const plotModalHeading = plotModal ? plotModal.querySelector('h2') : null;
            const plotFunctionBtn = document.getElementById('plotFunctionBtn');
            const plotFunctionAndDerivativeBtn = document.getElementById('plotFunctionAndDerivativeBtn');

            if (plotModal && functionInput && plotModalHeading && plotFunctionBtn && plotFunctionAndDerivativeBtn) {
                functionInput.value = '';
                plotModal.classList.remove('hidden');
                functionInput.focus();

                // Update modal heading and buttons for derivative input
                plotModalHeading.textContent = 'Enter function for derivative';
                plotFunctionBtn.style.display = 'none';
                plotFunctionAndDerivativeBtn.style.display = 'inline-block';

                console.log("Plot modal shown for derivative input");
            } else {
                alert("Plot modal or function input or buttons not found.");
                return;
            }
        });
    } else {
        console.warn("Derivative button not found.");
    }








    // --- FUNCTION PLOT MODAL ---
    const plotModal = document.getElementById("plotModal");
    const closePlotModal = document.getElementById("closePlotModal");
    const functionInput = document.getElementById("functionInput");
    const plotFunctionBtn = document.getElementById("plotFunctionBtn");
    const plotFunctionAndDerivativeBtn = document.getElementById("plotFunctionAndDerivativeBtn");

    if (closePlotModal) {
        closePlotModal.onclick = () => {
            hideModal("plotModal");

            // Reset plot modal heading and buttons to default
            const plotModal = document.getElementById('plotModal');
            const plotModalHeading = plotModal ? plotModal.querySelector('h2') : null;
            const plotFunctionBtn = document.getElementById('plotFunctionBtn');
            const plotFunctionAndDerivativeBtn = document.getElementById('plotFunctionAndDerivativeBtn');

            if (plotModalHeading && plotFunctionBtn && plotFunctionAndDerivativeBtn) {
                plotModalHeading.textContent = 'Plot Function';
                plotFunctionBtn.style.display = 'inline-block';
                plotFunctionAndDerivativeBtn.style.display = 'inline-block';
            }
        };
    } else {
        console.warn("Close Plot Modal button not found.");
    }

    if (plotFunctionBtn) {
        plotFunctionBtn.onclick = () => {
            const expr = functionInput.value.trim();
            if (!expr) {
                showCustomAlert("Please enter a function.");
                return;
            }
            // Prepare expression for math.js evaluation
            const parsedExpr = prepareExpression(expr);
            const table = generateFunctionTable(parsedExpr);
            if (table.length > 0) {
                plotGraph([{ data: table, label: 'f(x) = ' + expr, color: '#4285F4' }], expr);
                addToHistory(`Plotted: f(x) = ${expr}`, '');
                hideModal("plotModal");
            } else {
                showCustomAlert("Could not generate data for the plot. Check your function or range.");
            }
        };
    } else {
        console.warn("Plot Function button not found.");
    }

    if (plotFunctionAndDerivativeBtn) {
        plotFunctionAndDerivativeBtn.onclick = () => {
            const expr = functionInput.value.trim();
            if (!expr) {
                showCustomAlert("Please enter a function.");
                return;
            }
            try {
                plotAnyFunctionAndDerivative(expr);
                const derivativeExpr = math.derivative(expr, 'x').toString();
                addToHistory(`Plotted: f(x) = ${expr} and f'(x) = ${derivativeExpr}`, '');
                hideModal("plotModal");
            } catch (e) {
                showCustomAlert('Invalid expression for derivative: ' + e.message);
            }
        };
    } else {
        console.warn("Plot Function and Derivative button not found.");
    }

    // Define missing functions
    function performMatrixOperation() {
        const matrixInputA = document.getElementById('matrixInputA');
        const matrixInputB = document.getElementById('matrixInputB');
        const matrixOperationSelect = document.getElementById('matrixOperation');
        const matrixResultDiv = document.getElementById('matrixResult');

        if (typeof math === 'undefined') {
            matrixResultDiv.innerText = "Error: math.js library not loaded.";
            return;
        }

        const inputA = matrixInputA.value.trim();
        const inputB = matrixInputB.value.trim();
        const operation = matrixOperationSelect.value;
        let result = "";

        try {
            const A = math.evaluate(inputA);
            let B;
            if (inputB) B = math.evaluate(inputB);

            switch (operation) {
                case 'add':
                    result = math.add(A, B);
                    break;
                case 'subtract':
                    result = math.subtract(A, B);
                    break;
                case 'multiply':
                    result = math.multiply(A, B);
                    break;
                case 'inverse':
                    result = math.inv(A);
                    break;
                case 'transpose':
                    result = math.transpose(A);
                    break;
                case 'determinant':
                    result = math.det(A);
                    break;
                case 'dot':
                    result = math.dot(A, B);
                    break;
                case 'cross':
                    result = math.cross(A, B); // Only for 3D vectors
                    break;
                case 'magnitude':
                    result = math.norm(A); // math.norm is magnitude for vectors
                    break;
                default:
                    result = "Invalid operation.";
            }
            matrixResultDiv.innerText = JSON.stringify(result, null, 2);
            addToHistory(`Matrix/Vector Op: ${operation}`, JSON.stringify(result));
        } catch (e) {
            matrixResultDiv.innerText = "Error: " + e.message;
            console.error("Matrix/Vector Calculation Error:", e);
        }
    }

    function solveEquation() {
        const equationInput = document.getElementById('equationInput');
        const equationResult = document.getElementById('equationResult');

        if (typeof math === 'undefined') {
            equationResult.innerText = "Error: math.js library not loaded.";
            return;
        }

        const input = equationInput.value.trim();
        let result = "";

        try {
            // Step 1: Normalize the equation to the form f(x) = 0
            let equationExpression = input;
            if (input.includes('=')) {
                const parts = input.split('=');
                const leftSide = parts[0].trim();
                const rightSide = parts[1].trim();
                // Create an expression where rightSide is subtracted from leftSide
                equationExpression = `(${leftSide}) - (${rightSide})`;
            }

            // Step 2: Parse and simplify the expression to extract coefficients
            // Use math.js to parse the expression string into an expression tree.
            const node = math.parse(equationExpression);
            // Simplify the expression. This will combine like terms (e.g., 2x + 3x -> 5x)
            const simplifiedNode = math.simplify(node);

            // Define a scope for evaluation
            const scope = { x: 0 };

            // Extract coefficients by evaluating at specific points
            // This method works well for polynomial equations (linear, quadratic, cubic etc.)
            let c_val = 0;
            try {
                // Evaluate at x=0 to get the constant term (c)
                c_val = math.evaluate(simplifiedNode.toString(), { x: 0 });
                if (typeof c_val !== 'number') c_val = 0; // Ensure it's a number
            } catch (e) {
                console.warn("Could not evaluate constant term at x=0:", e.message);
                c_val = 0;
            }

            let valAt1 = 0;
            try {
                // Evaluate at x=1 to get (a + b + c) for quadratic, or (b + c) for linear
                valAt1 = math.evaluate(simplifiedNode.toString(), { x: 1 });
                if (typeof valAt1 !== 'number') valAt1 = 0;
            } catch (e) {
                console.warn("Could not evaluate at x=1:", e.message);
                valAt1 = 0;
            }

            let valAt2 = 0;
            try {
                // Evaluate at x=2 to get (4a + 2b + c) for quadratic, or (2b + c) for linear
                valAt2 = math.evaluate(simplifiedNode.toString(), { x: 2 });
                if (typeof valAt2 !== 'number') valAt2 = 0;
            } catch (e) {
                console.warn("Could not evaluate at x=2:", e.message);
                valAt2 = 0;
            }

            let a_coeff = 0; // Coefficient of x^2
            let b_coeff = 0; // Coefficient of x
            let c_coeff = c_val; // Constant term

            // Solve system of equations to find a_coeff and b_coeff
            // Eq1: a_coeff + b_coeff + c_coeff = valAt1
            // Eq2: 4*a_coeff + 2*b_coeff + c_coeff = valAt2

            // From Eq1: a_coeff + b_coeff = valAt1 - c_coeff
            // From Eq2: 4*a_coeff + 2*b_coeff = valAt2 - c_coeff

            // Let P1 = valAt1 - c_coeff
            // Let P2 = valAt2 - c_coeff

            // a_coeff + b_coeff = P1  => b_coeff = P1 - a_coeff
            // 4*a_coeff + 2*b_coeff = P2

            // Substitute b_coeff in second equation:
            // 4*a_coeff + 2*(P1 - a_coeff) = P2
            // 4*a_coeff + 2*P1 - 2*a_coeff = P2
            // 2*a_coeff = P2 - 2*P1
            // a_coeff = (P2 - 2*P1) / 2

            const P1 = valAt1 - c_coeff;
            const P2 = valAt2 - c_coeff;

            a_coeff = (P2 - 2 * P1) / 2;
            b_coeff = P1 - a_coeff;

            // Round coefficients to avoid floating point inaccuracies
            a_coeff = parseFloat(a_coeff.toFixed(10));
            b_coeff = parseFloat(b_coeff.toFixed(10));
            c_coeff = parseFloat(c_coeff.toFixed(10));


            // Step 3: Solve based on coefficients
            if (Math.abs(a_coeff) > 1e-9) { // Quadratic equation (A is not zero)
                const discriminant = b_coeff * b_coeff - 4 * a_coeff * c_coeff;

                if (discriminant >= 0) {
                    const x1 = (-b_coeff + Math.sqrt(discriminant)) / (2 * a_coeff);
                    const x2 = (-b_coeff - Math.sqrt(discriminant)) / (2 * a_coeff);
                    result = `x₁ = ${x1.toFixed(10)}, x₂ = ${x2.toFixed(10)}`;
                } else {
                    const realPart = (-b_coeff / (2 * a_coeff)).toFixed(10);
                    const imagPart = (Math.sqrt(Math.abs(discriminant)) / (2 * a_coeff)).toFixed(10);
                    result = `x₁ = ${realPart} + ${imagPart}i, x₂ = ${realPart} - ${imagPart}i`;
                }
            } else if (Math.abs(b_coeff) > 1e-9) { // Linear equation (A is zero, B is not zero)
                const x = -c_coeff / b_coeff;
                result = `x = ${x.toFixed(10)}`;
            } else { // Constant equation (A and B are zero)
                if (Math.abs(c_coeff) < 1e-9) { // C is effectively zero (e.g., 0 = 0)
                    result = "Equation is an identity (true for all x).";
                } else { // C is non-zero (e.g., 5 = 0)
                    result = "Equation has no solution.";
                }
            }
        } catch (e) {
            result = "Error: Invalid equation format or calculation issue: " + e.message;
            console.error("Equation Solver Error:", e);
        }
        equationResult.innerText = result;
        addToHistory(`Solved: ${input}`, result);
    }

    function convertBase() {
        const numberStr = document.getElementById('baseInput').value.trim();
        const fromBase = parseInt(document.getElementById('fromBase').value, 10);
        const toBase = parseInt(document.getElementById('toBase').value, 10);
        let result = "";

        if (!numberStr) {
            document.getElementById('baseResult').innerText = "Please enter a number.";
            return;
        }

        try {
            const decimalValue = parseInt(numberStr, fromBase);
            if (isNaN(decimalValue)) {
                result = "Invalid number for the selected 'From Base'.";
            } else {
                result = decimalValue.toString(toBase).toUpperCase(); // .toUpperCase() for hex
            }
        } catch (e) {
            result = "Error during conversion: " + e.message;
            console.error("Base Conversion Error:", e);
        }
        document.getElementById('baseResult').innerText = result;
        addToHistory(`Convert ${numberStr} (base ${fromBase}) to base ${toBase}`, result);
    }

    function calculateStatistic(type) {
        const statsInput = document.getElementById('statsInput');
        const statsResultDiv = document.getElementById('statsResult');

        if (typeof math === 'undefined') {
            statsResultDiv.innerText = "Error: math.js library not loaded.";
            return;
        }

        const input = statsInput.value.trim();
        if (!input) {
            statsResultDiv.innerText = "Please enter numbers separated by commas.";
            return;
        }

        try {
            const numbers = input.split(/\s+/).map(num => parseFloat(num.trim())).filter(num => !isNaN(num));

            if (numbers.length === 0) {
                statsResultDiv.innerText = "No valid numbers found.";
                return;
            }

            let result = "";
            switch (type) {
                case 'mean':
                    result = math.mean(numbers);
                    break;
                case 'median':
                    result = math.median(numbers);
                    break;
                case 'mode':
                    result = math.mode(numbers); // Returns an array
                    break;
                case 'stddev':
                    result = math.std(numbers); // Sample standard deviation
                    break;
                default:
                    result = "Invalid statistic.";
            }
            statsResultDiv.innerText = `${type}: ${Array.isArray(result) ? result.join(', ') : result.toFixed(4)}`;
            addToHistory(`Calculated ${type} for: ${input}`, Array.isArray(result) ? result.join(', ') : result.toFixed(2));
        } catch (e) {
            statsResultDiv.innerText = "Error calculating statistic: " + e.message;
            console.error("Statistics Calculation Error:", e);
        }
    }

    // New function to calculate and display all statistics at once
    function calculateAllStatistics() {
        const statsInput = document.getElementById('statsInput');
        const statsResultDiv = document.getElementById('statsResult');

        if (typeof math === 'undefined') {
            statsResultDiv.innerText = "Error: math.js library not loaded.";
            return;
        }

        const input = statsInput.value.trim();
        if (!input) {
            statsResultDiv.innerText = "Please enter numbers separated by spaces.";
            return;
        }

        try {
            const numbers = input.split(/\s+/).map(num => parseFloat(num.trim())).filter(num => !isNaN(num));

            if (numbers.length === 0) {
                statsResultDiv.innerText = "No valid numbers found.";
                return;
            }

            // Calculate statistics
            const mean = math.mean(numbers);
            const median = math.median(numbers);
            const modes = math.mode(numbers); // array of modes
            const min = math.min(numbers);
            const max = math.max(numbers);
            const sum = math.sum(numbers);
            const variance = math.variance(numbers, 'uncorrected'); // population variance
            const sampleVariance = math.variance(numbers, 'unbiased'); // sample variance
            const stddev = math.std(numbers, 'uncorrected'); // population stddev
            const sampleStddev = math.std(numbers, 'unbiased'); // sample stddev

            // Format modes as string
            const modesStr = Array.isArray(modes) ? modes.join(', ') : modes;

            // Format output string similar to the image
            const output =
                `Mean: ${mean.toFixed(4)}\n` +
                `Median: ${median.toFixed(4)}\n` +
                `Mode(s): ${modesStr}\n` +
                `Min: ${min.toFixed(4)}\n` +
                `Max: ${max.toFixed(4)}\n` +
                `Sum: ${sum.toFixed(4)}\n` +
                `Variance (sample): ${sampleVariance.toFixed(4)}\n` +
                `Standard Deviation (sample): ${sampleStddev.toFixed(4)}`;

            statsResultDiv.innerText = output;
            addToHistory(`Calculated all statistics for: ${input}`, output);
        } catch (e) {
            statsResultDiv.innerText = "Error calculating statistics: " + e.message;
            console.error("Statistics Calculation Error:", e);
        }
    }

    // Modal handlers for new features
    // Matrix modal
    if (document.getElementById('matrixCalculate')) {
        document.getElementById('matrixCalculate').addEventListener('click', performMatrixOperation);
    }
    if (document.getElementById('closeMatrixModal')) {
        document.getElementById('closeMatrixModal').addEventListener('click', () => hideModal('matrixModal'));
    }

    // Equation modal
    if (document.getElementById('solveEquation')) {
        document.getElementById('solveEquation').addEventListener('click', solveEquation);
    }
    if (document.getElementById('closeEquationModal')) {
        document.getElementById('closeEquationModal').addEventListener('click', () => hideModal('equationModal'));
    }

    // Base modal
    if (document.getElementById('convertBase')) {
        document.getElementById('convertBase').addEventListener('click', convertBase);
    }
    if (document.getElementById('closeBaseModal')) {
        document.getElementById('closeBaseModal').addEventListener('click', () => hideModal('baseModal'));
    }

    // Stats modal
    if (document.getElementById('closeStatsModal')) {
        document.getElementById('closeStatsModal').addEventListener('click', () => hideModal('statsModal'));
    }

    // Unit Converter
    const units = {
        length: ['meter', 'kilometer', 'mile', 'foot', 'inch', 'centimeter', 'millimeter'],
        mass: ['gram', 'kilogram', 'pound', 'ounce'],
        temperature: ['celsius', 'fahrenheit', 'kelvin'],
        time: ['second', 'minute', 'hour', 'day']
    };

    function populateUnits(category) {
        const fromUnit = document.getElementById('fromUnit');
        const toUnit = document.getElementById('toUnit');
        fromUnit.innerHTML = '';
        toUnit.innerHTML = '';
        units[category].forEach(unit => {
            const option1 = document.createElement('option');
            option1.value = unit;
            option1.textContent = unit;
            fromUnit.appendChild(option1);
            const option2 = document.createElement('option');
            option2.value = unit;
            option2.textContent = unit;
            toUnit.appendChild(option2);
        });
        // Set defaults
        fromUnit.value = units[category][0];
        toUnit.value = units[category][1] || units[category][0];
    }

    function convertUnit() {
        const input = parseFloat(document.getElementById('unitInput').value);
        const from = document.getElementById('fromUnit').value;
        const to = document.getElementById('toUnit').value;
        const output = document.getElementById('unitOutput');
        if (isNaN(input)) {
            output.value = '';
            return;
        }
        try {
            const result = math.unit(input, from).toNumber(to);
            output.value = result.toFixed(4);
        } catch (e) {
            output.value = 'Error';
        }
    }

    const unitCategory = document.getElementById('unitCategory');
    const unitInput = document.getElementById('unitInput');
    const fromUnit = document.getElementById('fromUnit');
    const toUnit = document.getElementById('toUnit');
    if (unitCategory && unitInput && fromUnit && toUnit) {
        populateUnits('length');
        unitCategory.addEventListener('change', () => populateUnits(unitCategory.value));
        unitInput.addEventListener('input', convertUnit);
        fromUnit.addEventListener('change', convertUnit);
        toUnit.addEventListener('change', convertUnit);
    }

    // Unit Converter modal
    if (document.getElementById('unitConverterBtn')) {
        document.getElementById('unitConverterBtn').addEventListener('click', () => showModal('unitConverterModal'));
    }
    if (document.getElementById('closeUnitConverterModal')) {
        document.getElementById('closeUnitConverterModal').addEventListener('click', () => hideModal('unitConverterModal'));
    }

    // Initial clear for the calculator screen
    clearAll();
    if (screen) screen.focus();
});

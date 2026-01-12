# 📊 Advanced Calculator

A modern, feature-rich calculator web application with multiple calculation modes, graphing capabilities, and AI-powered problem solving.

## ✨ Features

- **Basic Calculator**: Standard arithmetic operations with a clean, intuitive interface
- **Scientific Calculator**: Advanced mathematical functions and operations
- **Graphing Calculator**: Visualize mathematical functions with an interactive graph
- **AI-Powered Solver**: Get step-by-step solutions to complex problems
- **Modern UI**: Responsive design with light/dark theme support
- **Export Capabilities**: Save or share your calculations and graphs

## 🚀 Tech Stack

- **Frontend**: 
  - HTML5, CSS3, Vanilla JavaScript
  - Chart.js for graphing
  - MathJax for beautiful mathematical notation
  - Math.js for advanced calculations
  - jsPDF for PDF export

- **Backend**:
  - Node.js with Express
  - Google's Gemini API for AI-powered solutions

## 🛠️ Setup & Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/advanced-calculator.git
   cd advanced-calculator
   ```

2. **Set up the backend**
   ```bash
   cd backend
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the backend directory with your Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3000
   ```

4. **Start the development server**
   ```bash
   # In the backend directory
   npm run dev
   ```

5. **Open the application**
   Open `index.html` in your browser or use a local server like Live Server in VS Code.

## 🌐 Usage

1. **Basic Calculator**:
   - Use the number pad and operation buttons for standard calculations
   - Supports basic arithmetic (+, -, ×, ÷) and percentage calculations

2. **Scientific Calculator**:
   - Access advanced functions (sin, cos, tan, log, ln, etc.)
   - Use parentheses for complex expressions

3. **Graphing Calculator**:
   - Enter functions in terms of x (e.g., `sin(x) + x^2`)
   - Pan and zoom the graph for detailed inspection
   - Toggle between different graph types and styles

4. **AI Problem Solver**:
   - Type your math problem in natural language
   - Get step-by-step solutions with explanations
   - Supports a wide range of mathematical topics

## 📦 Dependencies

### Frontend
- Chart.js
- MathJax
- Math.js
- jsPDF

### Backend
- Express
- CORS
- dotenv
- node-fetch

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📬 Contact

For any questions or suggestions, please open an issue or contact the project maintainers.

---

Made with ❤️ by Likki Mahender Reddy

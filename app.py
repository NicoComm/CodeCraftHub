from flask import Flask, jsonify, request
from pathlib import Path
from datetime import datetime, timezone
import json


# Create the Flask application
app = Flask(__name__)

# Store courses.json in the same directory as this app.py file
DATA_FILE = Path(__file__).parent / "courses.json"

# These are the only status values allowed for a course
VALID_STATUSES = {
    "Not Started",
    "In Progress",
    "Completed"
}

# Every course must contain these fields when created or replaced
REQUIRED_FIELDS = {
    "name",
    "description",
    "target_date",
    "status"
}


# -------------------------------------------------------------------
# File helper functions
# -------------------------------------------------------------------

def ensure_data_file():
    """
    Create courses.json automatically if it does not already exist.

    The file starts with an empty JSON list because courses will be
    stored as a list of objects.
    """
    if not DATA_FILE.exists():
        with open(DATA_FILE, "w", encoding="utf-8") as file:
            json.dump([], file, indent=4)


def load_courses():
    """
    Read and return all courses from courses.json.

    Raises an error if the file cannot be read or contains invalid JSON.
    """
    ensure_data_file()

    with open(DATA_FILE, "r", encoding="utf-8") as file:
        courses = json.load(file)

    # The file should contain a JSON list
    if not isinstance(courses, list):
        raise ValueError("courses.json must contain a JSON list")

    return courses


def save_courses(courses):
    """
    Save the supplied list of courses to courses.json.
    """
    with open(DATA_FILE, "w", encoding="utf-8") as file:
        json.dump(courses, file, indent=4)


# -------------------------------------------------------------------
# Validation helper functions
# -------------------------------------------------------------------

def get_request_data():
    """
    Read JSON data from the request body.

    Returns:
        A dictionary containing the request data.

    Raises:
        ValueError if the request body is missing or invalid.
    """
    if not request.is_json:
        raise ValueError("Request body must contain JSON")

    data = request.get_json(silent=True)

    if data is None:
        raise ValueError("Request body must contain valid JSON")

    if not isinstance(data, dict):
        raise ValueError("Request JSON must be an object")

    return data


def validate_course_data(data, require_all_fields=True):
    """
    Validate course fields supplied by the client.

    Args:
        data: Dictionary received from the request.
        require_all_fields: If True, all required fields must exist.
                            This is used for POST and PUT.

    Returns:
        An error message string, or None if the data is valid.
    """
    if require_all_fields:
        missing_fields = REQUIRED_FIELDS - set(data.keys())

        if missing_fields:
            missing = ", ".join(sorted(missing_fields))
            return f"Missing required field(s): {missing}"

    # Validate fields that were supplied
    if "name" in data:
        if not isinstance(data["name"], str) or not data["name"].strip():
            return "name is required and must be a non-empty string"

    if "description" in data:
        if not isinstance(data["description"], str) or not data["description"].strip():
            return "description is required and must be a non-empty string"

    if "target_date" in data:
        target_date = data["target_date"]

        if not isinstance(target_date, str):
            return "target_date must be a string in YYYY-MM-DD format"

        try:
            # This checks both the format and whether the date is valid.
            # For example, 2026-02-30 will be rejected.
            datetime.strptime(target_date, "%Y-%m-%d")
        except ValueError:
            return "target_date must use the YYYY-MM-DD format"

    if "status" in data:
        if data["status"] not in VALID_STATUSES:
            allowed_statuses = ", ".join(sorted(VALID_STATUSES))
            return (
                f"Invalid status. Status must be one of: "
                f"{allowed_statuses}"
            )

    return None


def get_next_course_id(courses):
    """
    Generate the next course ID.

    IDs start at 1. The next ID is one greater than the current
    highest ID. This prevents duplicate IDs after deleting a course.
    """
    if not courses:
        return 1

    existing_ids = []

    for course in courses:
        try:
            existing_ids.append(int(course["id"]))
        except (KeyError, TypeError, ValueError):
            # Ignore malformed IDs in the file
            continue

    if not existing_ids:
        return 1

    return max(existing_ids) + 1


# -------------------------------------------------------------------
# API endpoints
# -------------------------------------------------------------------

@app.route("/api/courses", methods=["POST"])
@app.route("/api/courses/", methods=["POST"])
def create_course():
    """
    Add a new course.

    POST /api/courses
    """
    try:
        data = get_request_data()

        # POST requires every course field
        validation_error = validate_course_data(data, require_all_fields=True)

        if validation_error:
            return jsonify({"error": validation_error}), 400

        courses = load_courses()

        new_course = {
            "id": get_next_course_id(courses),
            "name": data["name"].strip(),
            "description": data["description"].strip(),
            "target_date": data["target_date"],
            "status": data["status"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        courses.append(new_course)
        save_courses(courses)

        return jsonify(new_course), 201

    except (OSError, IOError) as error:
        # Handles file read and write errors
        return jsonify({
            "error": "Unable to read or write courses.json",
            "details": str(error)
        }), 500

    except json.JSONDecodeError:
        return jsonify({
            "error": "courses.json contains invalid JSON"
        }), 500

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@app.route("/api/courses", methods=["GET"])
@app.route("/api/courses/", methods=["GET"])
def get_courses():
    """
    Return all courses.

    GET /api/courses
    """
    try:
        courses = load_courses()
        return jsonify(courses), 200

    except (OSError, IOError) as error:
        return jsonify({
            "error": "Unable to read courses.json",
            "details": str(error)
        }), 500

    except json.JSONDecodeError:
        return jsonify({
            "error": "courses.json contains invalid JSON"
        }), 500

    except ValueError as error:
        return jsonify({"error": str(error)}), 500


@app.route("/api/courses/<int:course_id>", methods=["GET"])
def get_course(course_id):
    """
    Return one course by ID.

    GET /api/courses/<id>
    """
    try:
        courses = load_courses()

        for course in courses:
            if course.get("id") == course_id:
                return jsonify(course), 200

        return jsonify({
            "error": f"Course with ID {course_id} was not found"
        }), 404

    except (OSError, IOError) as error:
        return jsonify({
            "error": "Unable to read courses.json",
            "details": str(error)
        }), 500

    except json.JSONDecodeError:
        return jsonify({
            "error": "courses.json contains invalid JSON"
        }), 500

    except ValueError as error:
        return jsonify({"error": str(error)}), 500


@app.route("/api/courses/<int:course_id>", methods=["PUT"])
def update_course(course_id):
    """
    Replace an existing course.

    PUT /api/courses/<id>

    PUT requires all editable course fields:
    name, description, target_date, and status.
    """
    try:
        data = get_request_data()

        # PUT replaces the course, so all required fields are needed
        validation_error = validate_course_data(data, require_all_fields=True)

        if validation_error:
            return jsonify({"error": validation_error}), 400

        courses = load_courses()

        for index, course in enumerate(courses):
            if course.get("id") == course_id:
                # Keep the original ID and created_at timestamp
                updated_course = {
                    "id": course["id"],
                    "name": data["name"].strip(),
                    "description": data["description"].strip(),
                    "target_date": data["target_date"],
                    "status": data["status"],
                    "created_at": course["created_at"]
                }

                courses[index] = updated_course
                save_courses(courses)

                return jsonify(updated_course), 200

        return jsonify({
            "error": f"Course with ID {course_id} was not found"
        }), 404

    except (OSError, IOError) as error:
        return jsonify({
            "error": "Unable to read or write courses.json",
            "details": str(error)
        }), 500

    except json.JSONDecodeError:
        return jsonify({
            "error": "courses.json contains invalid JSON"
        }), 500

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@app.route("/api/courses/<int:course_id>", methods=["DELETE"])
def delete_course(course_id):
    """
    Delete a course by ID.

    DELETE /api/courses/<id>
    """
    try:
        courses = load_courses()

        for index, course in enumerate(courses):
            if course.get("id") == course_id:
                deleted_course = courses.pop(index)
                save_courses(courses)

                return jsonify({
                    "message": "Course deleted successfully",
                    "course": deleted_course
                }), 200

        return jsonify({
            "error": f"Course with ID {course_id} was not found"
        }), 404

    except (OSError, IOError) as error:
        return jsonify({
            "error": "Unable to read or write courses.json",
            "details": str(error)
        }), 500

    except json.JSONDecodeError:
        return jsonify({
            "error": "courses.json contains invalid JSON"
        }), 500

    except ValueError as error:
        return jsonify({"error": str(error)}), 500


# -------------------------------------------------------------------
# Application startup
# -------------------------------------------------------------------

if __name__ == "__main__":
    # Create courses.json before starting the Flask server.
    # If creation fails, display a helpful message.
    try:
        ensure_data_file()
        print(f"Using data file: {DATA_FILE}")
    except OSError as error:
        print(f"Warning: Could not create courses.json: {error}")

    # debug=True is useful while learning and developing.
    # Do not use debug mode in a production deployment.
    app.run(debug=True)
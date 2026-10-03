import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VALID_STATUSES = ["Not Started", "In Progress", "Completed"];

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const path = url.pathname;

  // Extract /api/courses or /api/courses/{id}
  // The edge function is mounted at /functions/v1/api, so path looks like:
  // /functions/v1/api/courses or /functions/v1/api/courses/{id}
  const coursesMatch = path.match(/\/courses(?:\/([^/]+))?$/);

  if (!coursesMatch) {
    return errorResponse("Not found", 404);
  }

  const courseId = coursesMatch[1] || null;

  try {
    // ===== GET /api/courses or /api/courses/{id} =====
    if (req.method === "GET") {
      if (courseId) {
        const { data, error } = await supabase
          .from("courses")
          .select("*")
          .eq("id", courseId)
          .maybeSingle();

        if (error) return errorResponse(`Database error: ${error.message}`, 500);
        if (!data) return errorResponse("Course not found", 404);
        return jsonResponse(data);
      }

      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return errorResponse(`Database error: ${error.message}`, 500);
      return jsonResponse(data || []);
    }

    // ===== POST /api/courses =====
    if (req.method === "POST") {
      if (courseId) return errorResponse("POST to a specific ID is not allowed", 400);

      let body;
      try {
        body = await req.json();
      } catch {
        return errorResponse("Invalid JSON body", 400);
      }

      const { name, description, target_date, status } = body;

      if (!name || typeof name !== "string" || !name.trim()) {
        return errorResponse("Field 'name' is required", 400);
      }
      if (!description || typeof description !== "string" || !description.trim()) {
        return errorResponse("Field 'description' is required", 400);
      }
      if (!target_date || !/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
        return errorResponse("Field 'target_date' is required in YYYY-MM-DD format", 400);
      }
      if (!status || !VALID_STATUSES.includes(status)) {
        return errorResponse(`Field 'status' must be one of: ${VALID_STATUSES.join(", ")}`, 400);
      }

      const { data, error } = await supabase
        .from("courses")
        .insert({ name: name.trim(), description: description.trim(), target_date, status })
        .select()
        .single();

      if (error) return errorResponse(`Database error: ${error.message}`, 500);
      return jsonResponse(data, 201);
    }

    // ===== PUT /api/courses/{id} =====
    if (req.method === "PUT") {
      if (!courseId) return errorResponse("Course ID is required for PUT", 400);

      let body;
      try {
        body = await req.json();
      } catch {
        return errorResponse("Invalid JSON body", 400);
      }

      const updates = {};
      if (body.name !== undefined) {
        if (typeof body.name !== "string" || !body.name.trim()) {
          return errorResponse("Field 'name' cannot be empty", 400);
        }
        updates.name = body.name.trim();
      }
      if (body.description !== undefined) {
        if (typeof body.description !== "string" || !body.description.trim()) {
          return errorResponse("Field 'description' cannot be empty", 400);
        }
        updates.description = body.description.trim();
      }
      if (body.target_date !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.target_date)) {
          return errorResponse("Field 'target_date' must be in YYYY-MM-DD format", 400);
        }
        updates.target_date = body.target_date;
      }
      if (body.status !== undefined) {
        if (!VALID_STATUSES.includes(body.status)) {
          return errorResponse(`Field 'status' must be one of: ${VALID_STATUSES.join(", ")}`, 400);
        }
        updates.status = body.status;
      }

      if (Object.keys(updates).length === 0) {
        return errorResponse("No valid fields to update", 400);
      }

      const { data, error } = await supabase
        .from("courses")
        .update(updates)
        .eq("id", courseId)
        .select()
        .maybeSingle();

      if (error) return errorResponse(`Database error: ${error.message}`, 500);
      if (!data) return errorResponse("Course not found", 404);
      return jsonResponse(data);
    }

    // ===== DELETE /api/courses/{id} =====
    if (req.method === "DELETE") {
      if (!courseId) return errorResponse("Course ID is required for DELETE", 400);

      const { error, count } = await supabase
        .from("courses")
        .delete({ count: "exact" })
        .eq("id", courseId);

      if (error) return errorResponse(`Database error: ${error.message}`, 500);
      if (count === 0) return errorResponse("Course not found", 404);
      return jsonResponse({ message: "Course deleted successfully" });
    }

    return errorResponse(`Method ${req.method} not allowed`, 405);
  } catch (err) {
    return errorResponse(`Server error: ${err.message}`, 500);
  }
});

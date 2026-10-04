import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Image as ImageIcon,
  X,
  ArrowLeft,
  FileText,
} from "lucide-react";

import { API_BASE } from "../config";

function stripHtml(html = "") {
  return html.replace(/<[^>]+>/g, "").trim();
}

export default function AdminBlogEditor() {
  const [blogs, setBlogs] = useState([]);
  const [blogSearch, setBlogSearch] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const [blogForm, setBlogForm] = useState({
    title: "",
    content: "",
    image: "",
    author: "Admin",
  });

  const [editingBlog, setEditingBlog] = useState(null);
  const [editBlogForm, setEditBlogForm] = useState({
    title: "",
    content: "",
    image: "",
    author: "Admin",
  });

  const blogEditorModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", "image"],
      ["clean"],
    ],
  };

  const fetchBlogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/blogs`);
      const data = await res.json();
      setBlogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch blogs:", error);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const filteredBlogs = useMemo(() => {
    return blogs.filter((blog) => {
      const q = blogSearch.toLowerCase();

      return (
        (blog.title || "").toLowerCase().includes(q) ||
        (blog.author || "").toLowerCase().includes(q)
      );
    });
  }, [blogs, blogSearch]);

  const createBlog = async () => {
    try {
      const token =
        localStorage.getItem("blogEditorToken") ||
        localStorage.getItem("adminToken");

      const res = await fetch(`${API_BASE}/blogs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(blogForm),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to create blog");
        return;
      }

      alert("Blog published successfully");

      setBlogForm({
        title: "",
        content: "",
        image: "",
        author: "Admin",
      });

      setShowPreview(false);
      fetchBlogs();
    } catch (error) {
      console.error(error);
      alert("Failed to create blog");
    }
  };

  const deleteBlog = async (id) => {
    const ok = window.confirm("Delete this blog?");
    if (!ok) return;

    try {
      const token =
        localStorage.getItem("blogEditorToken") ||
        localStorage.getItem("adminToken");

      const res = await fetch(`${API_BASE}/blogs/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to delete blog");
        return;
      }

      fetchBlogs();
    } catch (error) {
      console.error(error);
      alert("Failed to delete blog");
    }
  };

  const startEditBlog = (blog) => {
    setEditingBlog(blog);

    setEditBlogForm({
      title: blog.title || "",
      content: blog.content || "",
      image: blog.image || "",
      author: blog.author || "Admin",
    });
  };

  const saveBlogEdit = async () => {
    try {
      const token =
        localStorage.getItem("blogEditorToken") ||
        localStorage.getItem("adminToken");

      const res = await fetch(`${API_BASE}/blogs/${editingBlog._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editBlogForm),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to update blog");
        return;
      }

      alert("Blog updated successfully");
      setEditingBlog(null);
      fetchBlogs();
    } catch (error) {
      console.error(error);
      alert("Failed to update blog");
    }
  };

  const handleBlogImageUpload = async (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      const token =
        localStorage.getItem("blogEditorToken") ||
        localStorage.getItem("adminToken");

      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Image upload failed");
        return;
      }

      if (isEdit) {
        setEditBlogForm((prev) => ({
          ...prev,
          image: data.imageUrl,
        }));
      } else {
        setBlogForm((prev) => ({
          ...prev,
          image: data.imageUrl,
        }));
      }
    } catch (error) {
      console.error(error);
      alert("Image upload failed");
    }
  };

  const inputClass =
    "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-950/40";

  const secondaryButtonClass =
    "inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

  const quillClass =
    "[&_.ql-toolbar]:rounded-t-3xl [&_.ql-toolbar]:border-slate-200 [&_.ql-toolbar]:bg-slate-50 [&_.ql-container]:min-h-[220px] [&_.ql-container]:rounded-b-3xl [&_.ql-container]:border-slate-200 [&_.ql-editor]:min-h-[220px] [&_.ql-editor]:text-slate-900 dark:[&_.ql-toolbar]:border-slate-700 dark:[&_.ql-toolbar]:bg-slate-800 dark:[&_.ql-container]:border-slate-700 dark:[&_.ql-editor]:bg-slate-800 dark:[&_.ql-editor]:text-slate-100 dark:[&_.ql-editor.ql-blank]:before:text-slate-500";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Admin Panel
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Blog Editor
            </h1>
          </div>

          <Link
            to="/admin"
            className={secondaryButtonClass}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          {/* Create blog */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20 md:p-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Content Studio
                </p>

                <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Publish a New Blog
                </h2>

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Create, preview, and publish articles for Saraswati Tutorials.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowPreview((prev) => !prev)}
                  className={secondaryButtonClass}
                >
                  <Eye className="h-4 w-4" />
                  {showPreview ? "Hide Preview" : "Preview"}
                </button>

                <button
                  type="button"
                  onClick={createBlog}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  <Plus className="h-4 w-4" />
                  Publish Blog
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Blog Title
                </label>

                <input
                  type="text"
                  value={blogForm.title}
                  onChange={(e) =>
                    setBlogForm((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Author Name
                </label>

                <input
                  type="text"
                  value={blogForm.author}
                  onChange={(e) =>
                    setBlogForm((prev) => ({
                      ...prev,
                      author: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Upload Cover Image
                </label>

                <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-slate-700">
                  <ImageIcon className="h-4 w-4" />
                  Choose image

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleBlogImageUpload(e)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {blogForm.image && (
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700">
                <img
                  src={blogForm.image}
                  alt="Blog cover preview"
                  loading="lazy"
                  className="h-56 w-full object-cover"
                />
              </div>
            )}

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Blog Content
              </label>

              <div
                className={`rounded-3xl bg-white dark:bg-slate-800 ${quillClass}`}
              >
                <ReactQuill
                  value={blogForm.content}
                  onChange={(value) =>
                    setBlogForm((prev) => ({
                      ...prev,
                      content: value,
                    }))
                  }
                  modules={blogEditorModules}
                  theme="snow"
                />
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20 md:p-8">
            <div className="mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-slate-600 dark:text-slate-300" />

              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Live Preview
              </h3>
            </div>

            {!showPreview ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-800/60">
                <Eye className="mx-auto h-10 w-10 text-slate-400" />

                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  Click Preview to see how your article will appear on the
                  website.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                {blogForm.image && (
                  <img
                    src={blogForm.image}
                    alt="Preview"
                    loading="lazy"
                    className="h-48 w-full object-cover"
                  />
                )}

                <div className="p-5">
                  <h4 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {blogForm.title || "Your blog title will appear here"}
                  </h4>

                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    By {blogForm.author || "Admin"}
                  </p>

                  <div
                    className="mt-5 max-w-none text-slate-700 dark:text-slate-300 [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-slate-900 dark:[&_h1]:text-slate-100 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-slate-100 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-slate-900 dark:[&_h3]:text-slate-100 [&_p]:mb-4 [&_p]:leading-7 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_strong]:font-bold [&_em]:italic [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline"
                    dangerouslySetInnerHTML={{
                      __html:
                        blogForm.content ||
                        "<p>Your blog content preview will appear here.</p>",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Manage blogs */}
        <div className="mt-10 rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20 md:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Library
              </p>

              <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Manage Blogs
              </h2>
            </div>

            <div className="relative w-full max-w-sm">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                value={blogSearch}
                onChange={(e) => setBlogSearch(e.target.value)}
                placeholder="Search blog title or author"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-blue-950/40"
              />
            </div>
          </div>

          {filteredBlogs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-700 dark:bg-slate-800/60">
              <FileText className="mx-auto h-10 w-10 text-slate-400" />

              <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                No blogs found.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {filteredBlogs.map((blog) => (
                <div
                  key={blog._id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800/70"
                >
                  {blog.image ? (
                    <img
                      src={blog.image}
                      alt={blog.title}
                      loading="lazy"
                      className="h-48 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-slate-100 text-sm font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                      No image
                    </div>
                  )}

                  <div className="p-5">
                    <h3 className="line-clamp-2 text-xl font-bold text-slate-900 dark:text-slate-100">
                      {blog.title}
                    </h3>

                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      By {blog.author || "Admin"}
                    </p>

                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {stripHtml(blog.content)}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => startEditBlog(blog)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteBlog(blog._id)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>

                      <Link
                        to={`/blogs/${blog.slug || blog._id}`}
                        target="_blank"
                        className={secondaryButtonClass}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit modal */}
      {editingBlog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Content Studio
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Edit Blog
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setEditingBlog(null)}
                aria-label="Close edit dialog"
                className="rounded-xl border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Blog Title
                </label>

                <input
                  type="text"
                  value={editBlogForm.title}
                  onChange={(e) =>
                    setEditBlogForm((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Author Name
                </label>

                <input
                  type="text"
                  value={editBlogForm.author}
                  onChange={(e) =>
                    setEditBlogForm((prev) => ({
                      ...prev,
                      author: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Change Cover Image
                </label>

                <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-slate-700">
                  <ImageIcon className="h-4 w-4" />
                  Choose image

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleBlogImageUpload(e, true)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {editBlogForm.image && (
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700">
                <img
                  src={editBlogForm.image}
                  alt="Edit preview"
                  loading="lazy"
                  className="h-56 w-full object-cover"
                />
              </div>
            )}

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Blog Content
              </label>

              <div
                className={`rounded-3xl bg-white dark:bg-slate-800 ${quillClass}`}
              >
                <ReactQuill
                  value={editBlogForm.content}
                  onChange={(value) =>
                    setEditBlogForm((prev) => ({
                      ...prev,
                      content: value,
                    }))
                  }
                  modules={blogEditorModules}
                  theme="snow"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveBlogEdit}
                className="rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Save Changes
              </button>

              <button
                type="button"
                onClick={() => setEditingBlog(null)}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

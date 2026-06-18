import os

script_dir = os.path.dirname(os.path.abspath(__file__))

# LƯU Ý: merge.py được đặt TRONG thư mục gốc của project (cùng cấp với package.json)
# nên project_root chính là thư mục chứa file này.
project_root = script_dir

output_dir = os.path.join(script_dir, 'Result')

# Cấu hình cho project TypeScript / React + Express (Vite)
extraction_tasks = {
    # --- File cấu hình gốc ---
    "config_files.txt": {
        "targets": [
            os.path.join(project_root, "package.json"),
            os.path.join(project_root, "tsconfig.json"),
            os.path.join(project_root, "vite.config.ts"),
            os.path.join(project_root, "index.html"),
            os.path.join(project_root, ".env.example"),
            os.path.join(project_root, ".gitignore"),
        ],
        "extensions": ()  # Không dùng cho file cụ thể, chỉ để tương thích cấu trúc
    },

    # --- Source code frontend (React / TSX / CSS) ---
    "frontend_source.txt": {
        "targets": [os.path.join(project_root, "src")],
        "extensions": (".ts", ".tsx", ".css")
    },

    # --- Backend Express ---
    "backend_source.txt": {
        "targets": [
            os.path.join(project_root, "server.ts"),
        ],
        "extensions": (".ts",)
    },
}

# Danh sách thư mục cần bỏ qua khi quét đệ quy
SKIP_DIRS = {"node_modules", "dist", ".vite", ".git", "Result"}


def write_file_content(outfile, filepath):
    outfile.write(f"\n{'=' * 80}\n")
    outfile.write(f"/// FILE: {os.path.relpath(filepath, project_root)} ///\n")
    outfile.write(f"{'=' * 80}\n\n")
    try:
        with open(filepath, 'r', encoding='utf-8') as infile:
            outfile.write(infile.read())
            outfile.write("\n")
    except Exception as e:
        outfile.write(f"// [Error reading file]: {e} //\n")


def run_extraction():
    os.makedirs(output_dir, exist_ok=True)
    print(f"Starting extraction from: {project_root}\n")

    for filename, config in extraction_tasks.items():
        output_path = os.path.join(output_dir, filename)
        count = 0

        with open(output_path, 'w', encoding='utf-8') as outfile:
            for target in config["targets"]:
                if not os.path.exists(target):
                    print(f"  [SKIP] Not found: {os.path.relpath(target, project_root)}")
                    continue

                if os.path.isfile(target):
                    # File cụ thể (vd: package.json, server.ts)
                    write_file_content(outfile, target)
                    count += 1
                else:
                    # Thư mục — quét đệ quy, bỏ qua các thư mục không cần thiết
                    for root, dirs, files in os.walk(target):
                        # Lọc các thư mục cần bỏ qua (chỉnh tại chỗ để os.walk không đi vào)
                        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

                        for file in sorted(files):
                            if config["extensions"] and file.endswith(config["extensions"]):
                                file_path = os.path.join(root, file)
                                write_file_content(outfile, file_path)
                                count += 1

        print(f"-> Created {filename} ({count} files included)")


if __name__ == "__main__":
    run_extraction()
    print("\nExtraction completed successfully. Check the 'Result' folder.")

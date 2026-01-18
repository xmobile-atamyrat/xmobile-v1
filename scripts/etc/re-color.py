from PIL import Image

def is_close_color(color1, color2, threshold=100):
    return all(abs(c1 - c2) < threshold for c1, c2 in zip(color1, color2))

def change_color(image_path, target_color, replacement_color, output_path):
    image = Image.open(image_path)
    pixels = image.load()

    target_rgb = tuple(int(target_color[i:i+2], 16) for i in (1, 3, 5))
    replacement_rgb = tuple(int(replacement_color[i:i+2], 16) for i in (1, 3, 5))

    for y in range(image.height):
        for x in range(image.width):
            current_color = pixels[x, y]
            if is_close_color(current_color, target_rgb):
                pixels[x, y] = replacement_rgb

    image.save(output_path)

# target color: MUI main color
# change_color('public/logo.jpeg', '#221765', '#1976d2', 'public/logo-recolored.jpeg')

# target color: orange
change_color('public/logo/logo.jpeg', '#221765', '#ff6f00', 'public/logo/logo-recolored.jpeg')